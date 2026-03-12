import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminService } from './admin.service'
import { AdminController } from './admin.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [ConfigModule, PrismaModule, BillingModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
