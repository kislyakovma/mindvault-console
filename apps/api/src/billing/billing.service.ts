import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const ASSISTANT_PRICE_KOPECKS = 49900 // 499 руб/мес

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ─── Баланс ───────────────────────────────────────────────────────────────

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balanceKopecks: true },
    })
    if (!user) throw new NotFoundException()
    return { balanceKopecks: user.balanceKopecks, balanceRub: (user.balanceKopecks / 100).toFixed(2) }
  }

  async getTransactions(userId: string, limit = 20) {
    return this.prisma.balanceTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  // Пополнение баланса (вызывается из платёжного вебхука)
  async topUp(userId: string, amountKopecks: number, description: string, meta?: object) {
    return this.prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: userId },
        data: { balanceKopecks: { increment: amountKopecks } },
      })
      return tx.balanceTransaction.create({
        data: { userId, amountKopecks, type: 'TOPUP', description, meta: meta ?? undefined },
      })
    })
  }

  // Ручная корректировка / бонус (для админа)
  async adminAdjust(userId: string, amountKopecks: number, description: string) {
    const type = amountKopecks > 0 ? 'BONUS' : 'ADJUSTMENT'
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { balanceKopecks: { increment: amountKopecks } },
        select: { balanceKopecks: true },
      })
      const tx_ = await tx.balanceTransaction.create({
        data: { userId, amountKopecks, type, description },
      })
      return { balanceKopecks: user.balanceKopecks, transaction: tx_ }
    })
  }

  // Списание за ассистента
  async charge(userId: string, amountKopecks: number, description: string, meta?: object) {
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { balanceKopecks: true } })
      if (!user) throw new NotFoundException()
      if (user.balanceKopecks < amountKopecks) {
        throw new BadRequestException('Недостаточно средств на балансе')
      }
      await tx.user.update({
        where: { id: userId },
        data: { balanceKopecks: { decrement: amountKopecks } },
      })
      return tx.balanceTransaction.create({
        data: { userId, amountKopecks: -amountKopecks, type: 'CHARGE', description, meta: meta ?? undefined },
      })
    })
  }

  // ─── Подписки на ассистентов ──────────────────────────────────────────────

  async listSubs(userId: string) {
    return this.prisma.assistantSubscription.findMany({
      where: { userId },
      include: { brief: { select: { id: true, title: true, botName: true, botStatus: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async subscribe(userId: string, briefId: string) {
    // Проверяем что бриф принадлежит пользователю
    const brief = await this.prisma.brief.findFirst({ where: { id: briefId, userId } })
    if (!brief) throw new NotFoundException('Ассистент не найден')

    // Проверяем нет ли уже активной подписки
    const existing = await this.prisma.assistantSubscription.findFirst({
      where: { userId, briefId, status: 'ACTIVE' },
    })
    if (existing) throw new BadRequestException('Подписка уже активна')

    // Списываем первый месяц
    await this.charge(userId, ASSISTANT_PRICE_KOPECKS, `Подписка на ассистента «${brief.title}»`, { briefId })

    const nextBillingAt = new Date()
    nextBillingAt.setMonth(nextBillingAt.getMonth() + 1)

    return this.prisma.assistantSubscription.create({
      data: { userId, briefId, priceKopecks: ASSISTANT_PRICE_KOPECKS, nextBillingAt, status: 'ACTIVE' },
      include: { brief: { select: { id: true, title: true } } },
    })
  }

  async cancelSub(userId: string, subId: string) {
    const sub = await this.prisma.assistantSubscription.findFirst({ where: { id: subId, userId } })
    if (!sub) throw new NotFoundException()
    return this.prisma.assistantSubscription.update({
      where: { id: subId },
      data: { status: 'CANCELLED' },
    })
  }

  // Для автосписания (cron)
  async processBilling() {
    const now = new Date()
    const dueSubs = await this.prisma.assistantSubscription.findMany({
      where: { status: 'ACTIVE', nextBillingAt: { lte: now } },
      include: { brief: { select: { title: true } }, user: { select: { balanceKopecks: true } } },
    })

    const results = await Promise.allSettled(dueSubs.map(async sub => {
      try {
        await this.charge(sub.userId, sub.priceKopecks, `Продление ассистента «${sub.brief.title}»`, { subId: sub.id })
        const next = new Date(sub.nextBillingAt)
        next.setMonth(next.getMonth() + 1)
        await this.prisma.assistantSubscription.update({ where: { id: sub.id }, data: { nextBillingAt: next } })
        return { id: sub.id, status: 'charged' }
      } catch {
        // Недостаточно средств — приостанавливаем
        await this.prisma.assistantSubscription.update({ where: { id: sub.id }, data: { status: 'PAUSED' } })
        return { id: sub.id, status: 'paused_insufficient_funds' }
      }
    }))

    return results
  }
}
