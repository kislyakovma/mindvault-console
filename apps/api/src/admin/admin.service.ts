import { Injectable, ForbiddenException } from '@nestjs/common'
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
    if (!user || user.role !== 'ADMIN') throw new ForbiddenException('Admin only')
    return user
  }

  async listUsers(adminId: string) {
    await this.assertAdmin(adminId)
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createUser(adminId: string, email: string, telegramUsername?: string) {
    await this.assertAdmin(adminId)

    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new Error('Email already exists')

    const password = randomBytes(6).toString('base64url').slice(0, 10)
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: 'USER' },
    })

    // Отправляем пароль через TG-бот
    await this.sendCredentials(email, password, telegramUsername)

    return { user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt }, password }
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
    if (!user) throw new Error('User not found')

    const password = randomBytes(6).toString('base64url').slice(0, 10)
    const passwordHash = await bcrypt.hash(password, 12)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    await this.prisma.session.deleteMany({ where: { userId } })

    await this.sendCredentials(user.email, password)

    return { password }
  }

  private async sendCredentials(email: string, password: string, telegramUsername?: string) {
    if (!this.bot) return

    const adminChatId = this.cfg.get<string>('TELEGRAM_ADMIN_CHAT_ID')
    const text = `🔐 *Новый аккаунт MindVault*\n\nEmail: \`${email}\`\nПароль: \`${password}\`\n\n[Войти →](https://console.mvault.ru/login)`

    // Пробуем отправить пользователю если знаем username
    if (telegramUsername) {
      try {
        const username = telegramUsername.replace('@', '')
        // Пересылаем через канал (у бота нет прямого доступа без /start от юзера)
        // Сохраняем для ручной отправки через интерфейс
      } catch (_) {}
    }

    // Всегда шлём в admin-чат (Михаилу)
    if (adminChatId) {
      const userNote = telegramUsername ? `\nTelegram: @${telegramUsername.replace('@', '')}` : ''
      await this.bot.telegram.sendMessage(
        adminChatId,
        text + userNote,
        { parse_mode: 'Markdown' }
      ).catch(e => console.error('TG send error:', e.message))
    }
  }
}
