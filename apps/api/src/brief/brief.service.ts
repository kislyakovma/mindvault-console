import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BriefService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const brief = await this.prisma.brief.findUnique({ where: { userId } })
    return brief ? { ...brief.dataJson as object, status: brief.status, updatedAt: brief.updatedAt } : null
  }

  async save(userId: string, data: Record<string, unknown>) {
    // Определяем заполненность: нужны хотя бы имя бота + роль или цели
    const filled = !!(data.botName || data.role || data.goals)
    const status = filled ? 'SUBMITTED' : 'DRAFT'

    const brief = await this.prisma.brief.upsert({
      where: { userId },
      create: { userId, dataJson: data, status },
      update: { dataJson: data, status },
    })
    return { status: brief.status, updatedAt: brief.updatedAt }
  }

  async getStatus(userId: string) {
    const brief = await this.prisma.brief.findUnique({
      where: { userId },
      select: { status: true, updatedAt: true },
    })
    return { hasBrief: !!brief && brief.status === 'SUBMITTED', briefStatus: brief?.status || null, briefUpdatedAt: brief?.updatedAt || null }
  }
}
