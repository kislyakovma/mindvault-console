import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ProvisioningService } from './provisioning.service'
import { ProvisioningController } from './provisioning.controller'
import { OpenRouterService } from './openrouter.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ProvisioningService, OpenRouterService],
  controllers: [ProvisioningController],
  exports: [ProvisioningService, OpenRouterService],
})
export class ProvisioningModule {}
