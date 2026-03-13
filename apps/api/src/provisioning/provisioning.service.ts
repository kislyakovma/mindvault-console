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
    telegramId?: string | null
    briefData: Record<string, any>
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
        telegramId: params.telegramId,
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
    const telegramId = brief.user.telegramId || null
    const deployResult = await this.deployAssistant({
      briefId: params.briefId,
      userId: params.userId,
      botToken: bot.token,
      openrouterKey: orKey,
      model,
      telegramId,
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
    telegramId?: string | null
    soul: string
    user: string
    userId: string
    briefId: string
    ocVersion: string
    callbackUrl: string
  }): string {
    const soulEscaped = params.soul.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
    const userEscaped = params.user.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
    const SERVICE = `mv-${params.userId.slice(0, 8)}-${params.briefId.slice(0, 8)}`
    // Каждый ассистент живёт в своём HOME — изолированный openclaw конфиг
    const ASSISTANT_HOME = `/opt/assistants/${params.userId}/${params.briefId}`
    // Порт gateway: уникальный на основе hash briefId (19000-19999)
    const port = 19000 + (parseInt(params.briefId.replace(/-/g, '').slice(0, 4), 16) % 1000)

    // Telegram channel — allowFrom содержит Telegram ID создателя
    const allowFrom = params.telegramId ? [params.telegramId] : ['*']
    const dmPolicy = params.telegramId ? 'allowlist' : 'open'

    const ocConfig = {
      channels: {
        telegram: {
          enabled: true,
          botToken: params.botToken,
          groupPolicy: 'disabled',
          dmPolicy,
          allowFrom,
          streaming: 'partial',
        }
      },
      gateway: {
        port: 19465,
        mode: 'local',
        bind: '0.0.0.0',
        auth: { mode: 'none' },
        tailscale: { mode: 'off', resetOnExit: false },
      },
      agents: {
        defaults: {
          workspace: '/home/oc/.openclaw/workspace',
          model: { primary: `openrouter/${params.model}` },
          compaction: { mode: 'safeguard' },
          maxConcurrent: 1,
          subagents: { maxConcurrent: 2 },
        }
      },
      plugins: {},
    }
    const configJson = JSON.stringify(ocConfig, null, 2)
    const CONTAINER = SERVICE

    return `#!/bin/bash
# MindVault Assistant Deploy Script (Docker)
# briefId: ${params.briefId}
# userId:  ${params.userId}
# userId:  ${params.userId}
set -euo pipefail

DATA_DIR="${ASSISTANT_HOME}"
CONTAINER="${CONTAINER}"
IMAGE="mindvault-assistant:latest"

echo "[1/4] Создаём директорию данных..."
mkdir -p "$DATA_DIR/.openclaw/workspace/vault"
chmod 700 "$DATA_DIR"

echo "[2/4] Записываем конфиг openclaw..."
cat > "$DATA_DIR/.openclaw/openclaw.json" << 'CONFIGEOF'
${configJson}
CONFIGEOF

echo "[3/4] Записываем workspace (SOUL, USER, AGENTS)..."
cat > "$DATA_DIR/.openclaw/workspace/SOUL.md" << 'SOULEOF'
${soulEscaped}
SOULEOF

cat > "$DATA_DIR/.openclaw/workspace/USER.md" << 'USEREOF'
${userEscaped}
USEREOF

if [ -f "/root/.openclaw/workspace/AGENTS.md" ]; then
  cp /root/.openclaw/workspace/AGENTS.md "$DATA_DIR/.openclaw/workspace/AGENTS.md"
fi

echo "[4/4] Запускаем Docker-контейнер..."
if docker inspect "$CONTAINER" &>/dev/null; then
  echo "  → Контейнер уже существует, обновляем конфиг и рестартуем..."
  docker restart "$CONTAINER"
else
  docker run -d \
    --name "$CONTAINER" \
    --restart unless-stopped \
    --memory=2g \
    --cpus=1 \
    -e OPENROUTER_API_KEY="${params.openrouterKey}" \
    -e HOME=/home/oc \
    -v "$DATA_DIR/.openclaw:/home/oc/.openclaw" \
    --network none \
    "$IMAGE"
fi

echo "Ожидаем запуска (до 30s)..."
for i in $(seq 1 6); do
  sleep 5
  STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
  if [ "$STATUS" = "running" ]; then
    echo "DEPLOYED_OK: $CONTAINER"
    exit 0
  fi
  echo "  [$i/6] status=$STATUS..."
done

echo "DEPLOY_FAILED: логи контейнера:"
docker logs "$CONTAINER" --tail 20
exit 1
\`
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
