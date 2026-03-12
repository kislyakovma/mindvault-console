import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { Telegraf } from 'telegraf'

@Injectable()
export class AdminService {
  private bot: Telegraf | null = null

  constructor(
    private prisma: PrismaService,
    private cfg: ConfigService,
  ) {
    const token = this.cfg.get<string>('TELEGRAM_BOT_TOKEN')
    if (token) this.bot = new Telegraf(token)
  }

  async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) throw new ForbiddenException('Admin only')
    return user
  }

  async assertSuperAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.role !== 'SUPERADMIN') throw new ForbiddenException('Superadmin only')
    return user
  }

  async listUsers(adminId: string, search?: string) {
    await this.assertAdmin(adminId)
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { telegramUsername: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, role: true, firstName: true, lastName: true, telegramUsername: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async setRole(superAdminId: string, userId: string, role: 'USER' | 'ADMIN') {
    await this.assertSuperAdmin(superAdminId)
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    })
  }

  async createUser(
    adminId: string,
    email: string,
    telegramUsername: string,
    firstName?: string,
    lastName?: string,
  ) {
    await this.assertAdmin(adminId)
    if (!telegramUsername) throw new BadRequestException('Telegram username is required')
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new BadRequestException('Email already exists')

    const password = randomBytes(6).toString('base64url').slice(0, 10)
    const passwordHash = await bcrypt.hash(password, 12)
    const tg = telegramUsername.replace('@', '')

    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: 'USER', firstName: firstName || null, lastName: lastName || null, telegramUsername: tg },
    })

    const sent = await this.sendCredentialsToUser(tg, email, password, firstName)

    return {
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, telegramUsername: user.telegramUsername, createdAt: user.createdAt },
      password,
      sentToUser: sent,
    }
  }

  async deleteUser(adminId: string, userId: string) {
    await this.assertAdmin(adminId)
    await this.prisma.session.deleteMany({ where: { userId } })
    await this.prisma.user.delete({ where: { id: userId } })
    return { ok: true }
  }

  async resetPassword(adminId: string, userId: string) {
    await this.assertAdmin(adminId)
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BadRequestException('User not found')

    const password = randomBytes(6).toString('base64url').slice(0, 10)
    const passwordHash = await bcrypt.hash(password, 12)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    await this.prisma.session.deleteMany({ where: { userId } })

    if (user.telegramUsername) {
      await this.sendCredentialsToUser(user.telegramUsername, user.email, password, user.firstName || undefined)
    }

    return { password, sentToUser: !!user.telegramUsername }
  }

  // ─── Briefs ──────────────────────────────────────────────────────────────

  async listUserBriefs(adminId: string, userId: string) {
    await this.assertAdmin(adminId)
    return this.prisma.brief.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, botName: true, botStatus: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getUserBrief(adminId: string, briefId: string) {
    await this.assertAdmin(adminId)
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } })
    if (!brief) throw new NotFoundException('Brief not found')
    return { ...brief.dataJson as object, id: brief.id, title: brief.title, status: brief.status, botName: brief.botName, botStatus: brief.botStatus, updatedAt: brief.updatedAt, user: brief.user }
  }

  async updateUserBrief(adminId: string, briefId: string, data: import('@prisma/client').Prisma.InputJsonValue, title?: string) {
    await this.assertAdmin(adminId)
    const brief = await this.prisma.brief.findUnique({ where: { id: briefId } })
    if (!brief) throw new NotFoundException('Brief not found')
    const d = data as Record<string, unknown>
    const filled = !!(d.botName || d.role || d.goals)
    return this.prisma.brief.update({
      where: { id: briefId },
      data: { dataJson: data, status: filled ? 'SUBMITTED' : 'DRAFT', botName: (d.botName as string) || brief.botName || null, title: title || brief.title },
      select: { id: true, title: true, status: true, botName: true, updatedAt: true },
    })
  }

  private async sendCredentialsToUser(
    telegramUsername: string,
    email: string,
    password: string,
    firstName?: string | null,
  ): Promise<boolean> {
    if (!this.bot) return false

    const name = firstName || 'Привет'
    const text =
      `${name}! 👋\n\n` +
      `Ваш аккаунт MindVault создан.\n\n` +
      `📧 Email: \`${email}\`\n` +
      `🔑 Пароль: \`${password}\`\n\n` +
      `[Войти в личный кабинет →](https://console.mvault.ru/login)\n\n` +
      `_Сохраните пароль — повторно он не отправляется._`

    try {
      const tgLower = telegramUsername.toLowerCase().replace('@', '')
      // Запрашиваем chat_id у webhook-сервера (знает всех кто писал боту)
      const webhookBase = this.cfg.get<string>('WEBHOOK_URL') || 'http://172.17.0.1:5679'
      const res = await fetch(`${webhookBase}/chatid?username=${tgLower}`)
      if (res.ok) {
        const data = await res.json() as { chat_id: string }
        await this.bot.telegram.sendMessage(data.chat_id, text, { parse_mode: 'Markdown' })
        return true
      }
    } catch (e) {
      console.error('TG send error:', (e as any).message)
    }

    // Fallback: отправить админу с пометкой
    const adminChatId = this.cfg.get<string>('TELEGRAM_ADMIN_CHAT_ID')
    if (adminChatId) {
      await this.bot.telegram.sendMessage(
        adminChatId,
        `⚠️ Не удалось найти @${telegramUsername} в базе бота (пользователь не писал боту).\n\n` +
        `Передайте вручную:\n📧 \`${email}\`\n🔑 \`${password}\``,
        { parse_mode: 'Markdown' }
      ).catch(() => {})
    }

    return false
  }
}
