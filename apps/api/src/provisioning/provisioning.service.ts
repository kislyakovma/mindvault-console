import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { OpenRouterService, PLAN_MODELS } from './openrouter.service'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as os from 'os'

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private or: OpenRouterService,
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
    botToken: string
    openrouterKey: string
    model?: string
    briefData: Record<string, any>
    // SSH оставляем для будущего, но деплоим локально
    sshHost?: string
    sshUser?: string
    sshPassword?: string
  }): Promise<{ success: boolean; message: string }> {
    const { briefId, userId, botToken, openrouterKey, briefData } = params

    await this.prisma.brief.update({
      where: { id: briefId },
      data: { botStatus: 'deploying' },
    })

    try {
      const soul = this.generateSoul(briefData)
      const user = this.generateUser(briefData)
      const ocVersion = '2026.3.11'
      const deployScript = this.buildDeployScript({
        botToken,
        openrouterKey,
        model: params.model || PLAN_MODELS.PLUS,
        soul,
        user,
        userId,
        briefId,
        ocVersion,
        callbackUrl: this.config.get('API_URL') || 'https://api.mvault.ru',
      })

      // Деплоим локально на основном сервере
      await this.runDeployScriptLocally(deployScript)

      await this.prisma.brief.update({
        where: { id: briefId },
        data: { botStatus: 'active' },
      })

      this.logger.log(`Assistant deployed locally for brief ${briefId}`)
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
    plan?: string
  }) {
    const brief = await this.prisma.brief.findUnique({
      where: { id: params.briefId },
      include: { user: true },
    })
    if (!brief) throw new Error('Brief not found')

    const data = brief.dataJson as Record<string, any>
    const botName = data.botName || brief.title || 'Ассистент'
    const plan = params.plan || 'PLUS'

    // 1. Создаём/получаем OpenRouter ключ для пользователя
    let orKey: string
    if (brief.user.orApiKey) {
      // Уже есть — переиспользуем
      orKey = brief.user.orApiKey
      this.logger.log(`Reusing existing OR key for user ${params.userId}`)
    } else {
      // Создаём новый с лимитом по плану
      this.logger.log(`Creating OR key for user ${params.userId} plan=${plan}`)
      const keyResult = await this.or.createKeyForUser(params.userId, plan)
      orKey = keyResult.key
      // Сохраняем в БД
      await this.prisma.user.update({
        where: { id: params.userId },
        data: { orApiKey: keyResult.key, orApiKeyHash: keyResult.hash },
      })
    }

    // 2. Бот: переиспользуем если уже создан, иначе создаём через BotFather
    let bot: { token: string; username: string }
    if (brief.botToken && brief.botName) {
      // Re-provision — бот уже существует
      bot = { token: brief.botToken, username: brief.botName.replace(/^@/, '') }
      this.logger.log(`Reusing existing bot @${bot.username} for brief ${params.briefId}`)
    } else {
      const slug = `mv_${params.userId.slice(0, 6)}_${params.briefId.slice(0, 6)}_bot`
        .replace(/[^a-z0-9_]/gi, '_')
        .toLowerCase()
      this.logger.log(`Creating bot: ${botName} (@${slug})`)
      bot = await this.createBot(botName, slug)
    }

    // 3. Сохраняем botName + botToken в бриф
    await this.prisma.brief.update({
      where: { id: params.briefId },
      data: {
        botName: `@${bot.username}`,
        botToken: bot.token,
        botStatus: 'deploying',
      },
    })

    // 5. Деплоим локально на основном сервере
    const model = PLAN_MODELS[plan.toUpperCase()] || PLAN_MODELS.PLUS
    const deployResult = await this.deployAssistant({
      briefId: params.briefId,
      userId: params.userId,
      botToken: bot.token,
      openrouterKey: orKey,
      model,
      briefData: data,
    })

    return {
      bot: { token: bot.token, username: bot.username },
      deploy: deployResult,
      plan,
      model,
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
    model: string
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

    // Читаем текущий конфиг основного сервера как шаблон
    let baseConfig: Record<string, any> = {}
    try {
      const raw = fs.readFileSync(`${os.homedir()}/.openclaw/openclaw.json`, 'utf8')
      baseConfig = JSON.parse(raw)
    } catch { /* используем пустой конфиг */ }

    // Убираем ключи которых нет в схеме OpenClaw
    for (const k of ['meta', 'wizard', 'auth', 'tools', 'messages', 'commands', 'session']) {
      delete baseConfig[k]
    }
    // Telegram channel
    baseConfig.channels = {
      telegram: {
        enabled: true,
        botToken: params.botToken,
        groupPolicy: 'disabled',
        dmPolicy: 'open',
        allowFrom: ['*'],
      }
    }
    // Gateway — всегда явно, независимо от шаблона
    baseConfig.gateway = {
      port,
      mode: 'local',
      bind: 'loopback',
      auth: { mode: 'none' },
      tailscale: { mode: 'off', resetOnExit: false },
    }
    // Agent model
    if (!baseConfig.agents) baseConfig.agents = {}
    if (!baseConfig.agents.defaults) baseConfig.agents.defaults = {}
    baseConfig.agents.defaults.workspace = `${ASSISTANT_HOME}/.openclaw/workspace`
    baseConfig.agents.defaults.model = {
      primary: `openrouter/${params.model}`,
      fallbacks: ['openrouter/auto'],
    }
    const configJson = JSON.stringify(baseConfig, null, 2)

    // Linux username: mv_ + первые 8 символов userId (только a-z0-9)
    const linuxUser = `mv_${params.userId.replace(/-/g, '').slice(0, 8)}`

    return `#!/bin/bash
# MindVault Assistant Deploy Script
# briefId: ${params.briefId}
# userId:  ${params.userId}
# service: ${SERVICE}
# port:    ${port}
set -euo pipefail

ASSISTANT_HOME="${ASSISTANT_HOME}"
SERVICE="${SERVICE}"
PORT="${port}"
NODE_BIN="/usr/bin/node"
OC_MAIN="/usr/lib/node_modules/openclaw/dist/index.js"
LINUX_USER="${linuxUser}"

echo "[1/7] Создаём изолированного Linux user..."
if ! id "$LINUX_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$LINUX_USER"
  echo "  → Создан system user: $LINUX_USER"
else
  echo "  → Уже существует: $LINUX_USER"
fi

echo "[2/7] Создаём директорию ассистента..."
mkdir -p "$ASSISTANT_HOME/.openclaw/workspace/vault"
# Права до записи файлов — пишем от root, потом передадим
chmod 700 "$ASSISTANT_HOME"

echo "[3/7] Записываем конфиг openclaw..."
cat > "$ASSISTANT_HOME/.openclaw/openclaw.json" << 'CONFIGEOF'
${configJson}
CONFIGEOF

echo "[4/7] Записываем workspace (SOUL, USER, AGENTS)..."
cat > "$ASSISTANT_HOME/.openclaw/workspace/SOUL.md" << 'SOULEOF'
${soulEscaped}
SOULEOF

cat > "$ASSISTANT_HOME/.openclaw/workspace/USER.md" << 'USEREOF'
${userEscaped}
USEREOF

# Копируем AGENTS.md с основного workspace
if [ -f "/root/.openclaw/workspace/AGENTS.md" ]; then
  cp /root/.openclaw/workspace/AGENTS.md "$ASSISTANT_HOME/.openclaw/workspace/AGENTS.md"
fi

echo "[5/7] Записываем .env..."
cat > "$ASSISTANT_HOME/.env" << 'ENVEOF'
OPENROUTER_API_KEY=${params.openrouterKey}
ENVEOF
chmod 600 "$ASSISTANT_HOME/.env"

echo "[6/7] Устанавливаем права (owner: $LINUX_USER)..."
chown -R "$LINUX_USER:$LINUX_USER" "$ASSISTANT_HOME"
# Директория недоступна другим пользователям
chmod 700 "$ASSISTANT_HOME"

echo "[7/7] Создаём systemd сервис..."
cat > "/etc/systemd/system/$SERVICE.service" << SVCEOF
[Unit]
Description=MindVault Assistant ${params.briefId.slice(0, 8)}
After=network.target

[Service]
User=$LINUX_USER
Group=$LINUX_USER
Environment=HOME=$ASSISTANT_HOME
EnvironmentFile=$ASSISTANT_HOME/.env
ExecStart=$NODE_BIN --max-old-space-size=768 $OC_MAIN gateway --port $PORT
Restart=always
RestartSec=15
TimeoutStartSec=60

# Изоляция процесса
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$ASSISTANT_HOME
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "Ожидаем запуска..."
sleep 6
if systemctl is-active "$SERVICE" --quiet; then
  echo "DEPLOYED_OK: $SERVICE port $PORT"
else
  echo "DEPLOY_FAILED: статус сервиса:"
  journalctl -u "$SERVICE" -n 15 --no-pager
  exit 1
fi
`
  }

  private async runDeployScriptLocally(script: string): Promise<void> {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const path = await import('path')
    const execAsync = promisify(exec)

    // Скрипт пишем в /opt/assistants/_deploys — директория должна быть примонтирована
    const deploysDir = '/opt/assistants/_deploys'
    try { fs.mkdirSync(deploysDir, { recursive: true }) } catch { /* ok */ }

    const scriptName = `deploy_${Date.now()}.sh`
    const tmpFile = path.join(deploysDir, scriptName)
    fs.writeFileSync(tmpFile, script, { mode: 0o700 })

    try {
      // SSH на хост через 172.17.0.1 (Docker gateway) — там root может systemctl
      const hostKey = this.config.get<string>('HOST_SSH_KEY_PATH') || '/run/secrets/host_ssh_key'
      const sshCmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ` +
        `-i ${hostKey} root@172.17.0.1 ` +
        `'bash /opt/assistants/_deploys/${scriptName}'`

      const { stdout, stderr } = await execAsync(sshCmd, { timeout: 120000 })
      this.logger.log(`Deploy output: ${stdout}`)
      if (stderr) this.logger.warn(`Deploy stderr: ${stderr}`)
      if (stdout.includes('DEPLOY_FAILED')) {
        throw new Error(`Deploy script reported failure:\n${stdout}`)
      }
    } finally {
      fs.unlink(tmpFile, () => {})
    }
  }

  // Оставляем SSH метод для возможного использования в будущем
  private async runDeployScriptViaSSH(
    host: string,
    user: string,
    password: string,
    script: string,
  ): Promise<void> {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const path = await import('path')
    const execAsync = promisify(exec)

    const tmpFile = path.join(os.tmpdir(), `deploy_${Date.now()}.sh`)
    fs.writeFileSync(tmpFile, script, { mode: 0o700 })

    try {
      const cmd = `sshpass -p '${password}' ssh -o StrictHostKeyChecking=no ${user}@${host} 'bash -s' < ${tmpFile}`
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 })
      this.logger.log(`Deploy output: ${stdout}`)
      if (stderr) this.logger.warn(`Deploy stderr: ${stderr}`)
    } finally {
      fs.unlink(tmpFile, () => {})
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
