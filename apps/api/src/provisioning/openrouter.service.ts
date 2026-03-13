import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as https from 'https'

export const PLAN_LIMITS: Record<string, number> = {
  PLUS:  20,   // $20/мес — claude-haiku
  PRO:   35,   // $35/мес — claude-sonnet
  MAX:   60,   // $60/мес — claude-opus
}

export const PLAN_MODELS: Record<string, string> = {
  PLUS: 'anthropic/claude-haiku-4-5',
  PRO:  'anthropic/claude-sonnet-4-5',
  MAX:  'anthropic/claude-opus-4-5',
}

interface ORKey {
  hash: string
  name: string
  label: string
  disabled: boolean
  limit: number | null
  limit_remaining: number | null
  usage: number
  usage_monthly: number
  created_at: string
}

interface ORCreateResult {
  key: string   // полный sk-or-v1-... ключ
  hash: string
  name: string
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name)
  private readonly baseUrl = 'https://openrouter.ai/api/v1'

  constructor(private config: ConfigService) {}

  private get mgmtKey() {
    return this.config.get<string>('OPENROUTER_MANAGEMENT_KEY') || ''
  }

  // Создать ключ для пользователя с лимитом по плану
  async createKeyForUser(userId: string, plan: string): Promise<ORCreateResult> {
    const limit = PLAN_LIMITS[plan.toUpperCase()] ?? PLAN_LIMITS.PLUS
    const name = `mindvault_${plan.toLowerCase()}_${userId.slice(0, 8)}`

    const body = JSON.stringify({ name, limit })
    const result = await this.post('/keys', body)

    if (!result.key) throw new Error(`OpenRouter key creation failed: ${JSON.stringify(result)}`)

    this.logger.log(`Created OR key for user ${userId} plan=${plan} limit=$${limit}`)
    return { key: result.key, hash: result.hash, name }
  }

  // Обновить лимит существующего ключа
  async updateKeyLimit(keyHash: string, plan: string): Promise<void> {
    const limit = PLAN_LIMITS[plan.toUpperCase()] ?? PLAN_LIMITS.PLUS
    await this.patch(`/keys/${keyHash}`, JSON.stringify({ limit }))
    this.logger.log(`Updated OR key ${keyHash} limit=$${limit}`)
  }

  // Деактивировать ключ (при отмене подписки)
  async disableKey(keyHash: string): Promise<void> {
    await this.patch(`/keys/${keyHash}`, JSON.stringify({ disabled: true }))
    this.logger.log(`Disabled OR key ${keyHash}`)
  }

  // Удалить ключ (при удалении аккаунта)
  async deleteKey(keyHash: string): Promise<void> {
    await this.delete(`/keys/${keyHash}`)
    this.logger.log(`Deleted OR key ${keyHash}`)
  }

  // Получить usage ключа
  async getKeyUsage(keyHash: string): Promise<{ usage: number; limit: number | null; remaining: number | null }> {
    const keys: { data: ORKey[] } = await this.get('/keys')
    const key = keys.data?.find(k => k.hash === keyHash)
    if (!key) throw new Error(`Key ${keyHash} not found`)
    return {
      usage: key.usage ?? 0,
      limit: key.limit,
      remaining: key.limit_remaining,
    }
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────

  private request(method: string, path: string, body?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`)
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${this.mgmtKey}`,
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      }, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)) }
        })
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  private get = (path: string) => this.request('GET', path)
  private post = (path: string, body: string) => this.request('POST', path, body)
  private patch = (path: string, body: string) => this.request('PATCH', path, body)
  private delete = (path: string) => this.request('DELETE', path)
}
