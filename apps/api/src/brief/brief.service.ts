import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BriefService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.brief.findMany({
      where: { userId },
      select: { id: true, title: true, status: true, botName: true, botStatus: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    })
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
