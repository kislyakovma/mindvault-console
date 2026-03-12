import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common'
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
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    })
    return user
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
      data: {
        email,
        passwordHash,
        role: 'USER',
        firstName: firstName || null,
        lastName: lastName || null,
        telegramUsername: tg,
      },
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

  // Отправка через бота напрямую пользователю по username
  private async sendCredentialsToUser(
    telegramUsername: string,
    email: string,
    password: string,
    firstName?: string | null,
  ): Promise<boolean> {
    if (!this.bot) return false

    const name = firstName ? firstName : 'Привет'
    const text =
      `${name}! 👋\n\n` +
      `Ваш аккаунт MindVault создан.\n\n` +
      `📧 Email: \`${email}\`\n` +
      `🔑 Пароль: \`${password}\`\n\n` +
      `[Войти в личный кабинет →](https://console.mvault.ru/login)\n\n` +
      `_Сохраните пароль — повторно он не отправляется._`

    try {
      // Telegram не позволяет отправить по username без chat_id
      // Используем getUpdates чтобы найти chat_id по username
      const updates = await this.bot.telegram.getUpdates(0, 100, undefined, ['message'])
      const tgLower = telegramUsername.toLowerCase().replace('@', '')

      const match = updates.find(u => {
        const msg = (u as any).message
        return msg?.from?.username?.toLowerCase() === tgLower
      })

      const chatId = (match as any)?.message?.chat?.id
      if (chatId) {
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
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
        `⚠️ Не удалось отправить напрямую @${telegramUsername} (пользователь не писал боту).\n\n` +
        `Передайте вручную:\n📧 \`${email}\`\n🔑 \`${password}\``,
        { parse_mode: 'Markdown' }
      ).catch(() => {})
    }

    return false
  }
}
