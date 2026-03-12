import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  async signup(email: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new ConflictException('Email already registered')
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await this.prisma.user.create({ data: { email, passwordHash } })
    const { accessToken, refreshToken } = await this.issueTokens(user.id)
    await this.saveRefreshToken(user.id, refreshToken)
    return { accessToken, refreshToken, user: this.sanitize(user) }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new UnauthorizedException()
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) throw new UnauthorizedException()
    const { accessToken, refreshToken } = await this.issueTokens(user.id)
    await this.saveRefreshToken(user.id, refreshToken)
    return { accessToken, refreshToken, user: this.sanitize(user) }
  }

  async refresh(token: string) {
    const hash = await bcrypt.hash(token, 10)
    const session = await this.prisma.session.findFirst({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
    })
    if (!session) throw new UnauthorizedException()
    const ok = await bcrypt.compare(token, session.refreshTokenHash)
    if (!ok) throw new UnauthorizedException()
    await this.prisma.session.delete({ where: { id: session.id } })
    const { accessToken, refreshToken } = await this.issueTokens(session.userId)
    await this.saveRefreshToken(session.userId, refreshToken)
    return { accessToken, refreshToken }
  }

  async logout(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } })
  }

  private async issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId })
    const refreshToken = randomBytes(40).toString('hex')
    return { accessToken, refreshToken }
  }

  private async saveRefreshToken(userId: string, token: string) {
    const refreshTokenHash = await bcrypt.hash(token, 10)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await this.prisma.session.create({ data: { userId, refreshTokenHash, expiresAt } })
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; telegramUsername?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        telegramUsername: data.telegramUsername ? data.telegramUsername.replace('@', '') : undefined,
      },
    })
    return { user: this.sanitize(user) }
  }

  sanitize(user: any) {
    const { passwordHash, ...rest } = user
    return rest
  }
}
