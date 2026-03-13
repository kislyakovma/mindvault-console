import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ProvisioningService } from './provisioning.service'
import { ProvisioningController } from './provisioning.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ProvisioningService],
  controllers: [ProvisioningController],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
