import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProvisioningService {
  constructor(private prisma: PrismaService) {}
}
