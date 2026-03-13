import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { OpenRouterService, PLAN_LIMITS } from '../provisioning/openrouter.service'

const PLAN_LABELS: Record<string, string> = {
  PLUS: 'Plus',
  PRO: 'Pro',
  MAX: 'Max',
}

@Injectable()
export class BriefService {
  constructor(
    private prisma: PrismaService,
    private or: OpenRouterService,
  ) {}

  async list(userId: string) {
    const briefs = await this.prisma.brief.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, botName: true, botStatus: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // Подтягиваем подписки и OR usage за один запрос
    const subs = await this.prisma.assistantSubscription.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { briefId: true, plan: true },
    })
    const subMap = Object.fromEntries(subs.map(s => [s.briefId, s.plan]))

    // OR usage — один запрос на пользователя
    let orUsage: Record<string, { usageCents: number; limitCents: number }> = {}
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { orApiKeyHash: true } })
    if (user?.orApiKeyHash) {
      try {
        const info = await this.or.getKeyUsage(user.orApiKeyHash)
        // usage хранится в $ у OR, конвертируем в центы для всех брифов пользователя
        const plan = subs[0]?.plan || 'PLUS'
        const limitDollars = PLAN_LIMITS[plan] ?? PLAN_LIMITS.PLUS
        const usageDollars = info.usage ?? 0
        // Один ключ на пользователя — делим на кол-во активных брифов условно
        briefs.forEach(b => {
          if (subMap[b.id]) {
            orUsage[b.id] = {
              usageCents: Math.round(usageDollars * 100),
              limitCents: Math.round(limitDollars * 100),
            }
          }
        })
      } catch { /* молча */ }
    }

    return briefs.map(b => ({
      ...b,
      plan: subMap[b.id] ? PLAN_LABELS[subMap[b.id]] || subMap[b.id] : null,
      usageCents: orUsage[b.id]?.usageCents ?? null,
      limitCents: orUsage[b.id]?.limitCents ?? null,
    }))
  }

  async get(userId: string, briefId: string) {
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId } })
    if (!brief) throw new NotFoundException()
    if (brief.userId !== userId) throw new ForbiddenException()
    return { ...brief.dataJson as object, id: brief.id, title: brief.title, status: brief.status, botName: brief.botName, botStatus: brief.botStatus, updatedAt: brief.updatedAt }
  }

  async create(userId: string, title: string) {
    const brief = await this.prisma.brief.create({
      data: { userId, title, dataJson: {}, status: 'DRAFT' },
    })
    return { id: brief.id, title: brief.title, status: brief.status }
  }

  async save(userId: string, briefId: string, data: Prisma.InputJsonValue) {
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId } })
    if (!brief) throw new NotFoundException()
    if (brief.userId !== userId) throw new ForbiddenException()

    const d = data as Record<string, unknown>
    const filled = !!(d.botName || d.role || d.goals)
    const status = filled ? 'SUBMITTED' : 'DRAFT'
    const botName = (d.botName as string) || brief.botName || null

    const updated = await this.prisma.brief.update({
      where: { id: briefId },
      data: { dataJson: data, status, botName, title: (d.title as string) || brief.title },
    })
    return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt }
  }

  async delete(userId: string, briefId: string) {
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId } })
    if (!brief) throw new NotFoundException()
    if (brief.userId !== userId) throw new ForbiddenException()
    await this.prisma.brief.delete({ where: { id: briefId } })
    return { ok: true }
  }

  async getStatusForDashboard(userId: string) {
    const briefs = await this.prisma.brief.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, botName: true, botStatus: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return {
      hasBrief: briefs.some(b => b.status === 'SUBMITTED'),
      briefs,
    }
  }
}
