import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BriefService {
  constructor(private prisma: PrismaService) {}
}
