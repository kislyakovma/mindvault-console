import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}
}
