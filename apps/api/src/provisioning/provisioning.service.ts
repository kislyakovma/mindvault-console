import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import * as https from 'https'
import * as http from 'http'

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ─── BotFactory ───────────────────────────────────────────────────────────

  async createBot(name: string, username: string): Promise<{ token: string; username: string }> {
    const url = this.config.get('BOTFACTORY_URL') || 'http://localhost:7001'
    const secret = this.config.get('BOTFACTORY_SECRET') || ''

    const body = JSON.stringify({ name, username })
    const result = await this.httpPost(`${url}/create`, body, {
      'Content-Type': 'application/json',
      'X-Secret': secret,
    })

    if (!result.token) throw new Error(`BotFactory error: ${JSON.stringify(result)}`)
    return result
  }

  // ─── Deploy OpenClaw на VPS ───────────────────────────────────────────────

  async deployAssistant(params: {
    briefId: string
    userId: string
    sshHost: string
    sshUser: string
    sshPassword: string
    botToken: string
    openrouterKey: string
    briefData: Record<string, any>
  }): Promise<{ success: boolean; message: string }> {
    const { briefId, userId, sshHost, botToken, openrouterKey, briefData } = params

    // Обновляем статус → deploying
    await this.prisma.brief.update({
      where: { id: briefId },
      data: { botStatus: 'deploying' },
    })

    try {
      // Генерируем SOUL.md из данных брифа
      const soul = this.generateSoul(briefData)
      const user = this.generateUser(briefData)

      // Деплой скрипт (выполняется на VPS через SSH)
      const ocVersion = '2026.3.11'
      const deployScript = this.buildDeployScript({
        botToken,
        openrouterKey,
        soul,
        user,
        userId,
        briefId,
        ocVersion,
        callbackUrl: this.config.get('API_URL') || 'https://api.mvault.ru',
      })

      // Запускаем деплой через webhook-сервер или SSH executor
      // Для MVP — вызываем SSH через child_process
      await this.runDeployScript(sshHost, params.sshUser, params.sshPassword, deployScript)

      await this.prisma.brief.update({
        where: { id: briefId },
        data: { botStatus: 'active' },
      })

      this.logger.log(`Assistant deployed for brief ${briefId} on ${sshHost}`)
      return { success: true, message: 'Assistant deployed successfully' }
    } catch (e) {
      this.logger.error(`Deploy failed for brief ${briefId}: ${e.message}`)
      await this.prisma.brief.update({
        where: { id: briefId },
        data: { botStatus: 'error' },
      })
      return { success: false, message: e.message }
    }
  }

  // ─── Full Provision (создать бота + задеплоить) ───────────────────────────

  async provisionAssistant(params: {
    briefId: string
    userId: string
    sshHost: string
    sshUser?: string
    sshPassword?: string
    openrouterKey: string
  }) {
    const brief = await this.prisma.brief.findUnique({
      where: { id: params.briefId },
      include: { user: true },
    })
    if (!brief) throw new Error('Brief not found')

    const data = brief.dataJson as Record<string, any>
    const botName = data.botName || brief.title || 'Ассистент'

    // 1. Генерируем уникальный username для бота
    const slug = `mv_${params.userId.slice(0, 6)}_${params.briefId.slice(0, 6)}_bot`
      .replace(/[^a-z0-9_]/gi, '_')
      .toLowerCase()

    // 2. Создаём бота через BotFather
    this.logger.log(`Creating bot: ${botName} (@${slug})`)
    const bot = await this.createBot(botName, slug)

    // 3. Сохраняем botName в бриф
    await this.prisma.brief.update({
      where: { id: params.briefId },
      data: { botName: `@${bot.username}`, botStatus: 'deploying' },
    })

    // 4. Деплоим на VPS
    const deployResult = await this.deployAssistant({
      briefId: params.briefId,
      userId: params.userId,
      sshHost: params.sshHost,
      sshUser: params.sshUser || 'root',
      sshPassword: params.sshPassword || '',
      botToken: bot.token,
      openrouterKey: params.openrouterKey,
      briefData: data,
    })

    return {
      bot: { token: bot.token, username: bot.username },
      deploy: deployResult,
    }
  }

  // ─── Генераторы конфига ───────────────────────────────────────────────────

  private generateSoul(data: Record<string, any>): string {
    const name = data.botName || 'Ассистент'
    const role = data.role || 'Личный AI-ассистент'
    const commStyle = data.commStyle || 'дружелюбно и профессионально'
    const lang = data.language || 'ru'
    return `# SOUL.md

## Кто ты
Тебя зовут ${name}. Ты личный AI-ассистент своего пользователя.
Роль: ${role}.
Общайся ${commStyle}.
Язык: ${lang === 'ru' ? 'русский' : lang}.

## Характер
- Краткий по умолчанию, без лишних слов
- Без «Конечно!», «Отличный вопрос!» и корпоративного мусора
- Помогаешь думать, структурировать, действовать
- Отвечаешь на «ты»

## Интересы пользователя
${data.interests ? `- ${data.interests}` : ''}
${data.goals ? `- Цели: ${data.goals}` : ''}
`
  }

  private generateUser(data: Record<string, any>): string {
    const tg = data.telegramUsername || ''
    return `# USER.md
- **Telegram:** ${tg ? `@${tg}` : 'не указан'}
- **Timezone:** ${data.timezone || 'UTC'}
- **Рабочее время:** ${data.workTime || 'в любое время'}
- **Проекты:** ${(data.projects || []).map((p: any) => p.name).join(', ') || 'не указаны'}
- **Контекст:** ${data.lifeContext || ''}
`
  }

  private buildDeployScript(params: {
    botToken: string
    openrouterKey: string
    soul: string
    user: string
    userId: string
    briefId: string
    ocVersion: string
    callbackUrl: string
  }): string {
    const soulEscaped = params.soul.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
    const userEscaped = params.user.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
    const SERVICE = `mindvault-assistant-${params.briefId.slice(0, 8)}`
    // Каждый ассистент живёт в своём HOME — изолированный openclaw конфиг
    const ASSISTANT_HOME = `/opt/assistants/${params.userId}/${params.briefId}`
    // Порт gateway: уникальный на основе hash briefId (19000-19999)
    const port = 19000 + (parseInt(params.briefId.replace(/-/g, '').slice(0, 4), 16) % 1000)

    return `#!/bin/bash
set -e

ASSISTANT_HOME="${ASSISTANT_HOME}"
SERVICE="${SERVICE}"
PORT="${port}"
NODE_BIN="/usr/bin/node"
OC_MAIN="/usr/lib/node_modules/openclaw/dist/index.js"

# 1. Установка openclaw если нет
if [ ! -f "$OC_MAIN" ]; then
  echo "Installing openclaw..."
  NODE_OPTIONS="--max-old-space-size=512" npm install -g openclaw --ignore-scripts 2>&1
fi

# 2. Создаём директорию ассистента
mkdir -p "$ASSISTANT_HOME/.openclaw/workspace/vault"
mkdir -p "$ASSISTANT_HOME/.openclaw/agents"

# 3. Конфиг openclaw (~/.openclaw/openclaw.json в ASSISTANT_HOME)
cat > "$ASSISTANT_HOME/.openclaw/openclaw.json" << 'CONFIGEOF'
{
  "meta": { "version": 1 },
  "wizard": { "completed": true },
  "auth": {},
  "agents": {
    "defaults": {
      "model": { "primary": "openrouter/anthropic/claude-sonnet-4-6" },
      "workspaceDir": "${ASSISTANT_HOME}/.openclaw/workspace"
    }
  },
  "tools": {},
  "messages": {},
  "commands": {},
  "session": {},
  "channels": {
    "telegram": {
      "token": "${params.botToken}",
      "groupPolicy": "deny"
    }
  },
  "gateway": {
    "port": ${port},
    "mode": "local",
    "bind": "loopback",
    "auth": { "mode": "none" }
  },
  "plugins": {}
}
CONFIGEOF

# 4. SOUL.md
cat > "$ASSISTANT_HOME/.openclaw/workspace/SOUL.md" << 'SOULEOF'
${soulEscaped}
SOULEOF

# 5. USER.md
cat > "$ASSISTANT_HOME/.openclaw/workspace/USER.md" << 'USEREOF'
${userEscaped}
USEREOF

# 6. AGENTS.md
if [ -f "/usr/lib/node_modules/openclaw/docs/AGENTS.md" ]; then
  cp /usr/lib/node_modules/openclaw/docs/AGENTS.md "$ASSISTANT_HOME/.openclaw/workspace/AGENTS.md"
fi

# 7. Env с API ключом
cat > "$ASSISTANT_HOME/.env" << 'ENVEOF'
OPENROUTER_API_KEY=${params.openrouterKey}
HOME=${ASSISTANT_HOME}
ENVEOF

# 8. systemd сервис (user-level не работает без loginctl, ставим system)
cat > "/etc/systemd/system/$SERVICE.service" << SVCEOF
[Unit]
Description=MindVault Assistant ${params.briefId.slice(0, 8)}
After=network.target

[Service]
Environment=HOME=$ASSISTANT_HOME
EnvironmentFile=$ASSISTANT_HOME/.env
ExecStart=$NODE_BIN $OC_MAIN gateway --port $PORT
Restart=always
RestartSec=10
TimeoutStartSec=30

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"
sleep 3
systemctl is-active "$SERVICE" && echo "DEPLOYED_OK: $SERVICE port $PORT" || (journalctl -u "$SERVICE" -n 5 --no-pager; echo "DEPLOY_FAILED")
`
  }

  private async runDeployScript(
    host: string,
    user: string,
    password: string,
    script: string,
  ): Promise<void> {
    // Запускаем через sshpass + ssh
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    const fs = await import('fs')
    const os = await import('os')
    const path = await import('path')

    // Пишем скрипт во временный файл
    const tmpFile = path.join(os.tmpdir(), `deploy_${Date.now()}.sh`)
    fs.writeFileSync(tmpFile, script, { mode: 0o700 })

    try {
      const cmd = `sshpass -p '${password}' ssh -o StrictHostKeyChecking=no ${user}@${host} 'bash -s' < ${tmpFile}`
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 })
      this.logger.log(`Deploy output: ${stdout}`)
      if (stderr) this.logger.warn(`Deploy stderr: ${stderr}`)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  }

  // ─── HTTP helper ─────────────────────────────────────────────────────────

  private httpPost(url: string, body: string, headers: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      }, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error(`Invalid JSON: ${data}`)) }
        })
      })
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }
}
