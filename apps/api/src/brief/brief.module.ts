import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BriefService } from './brief.service'
import { BriefController } from './brief.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { OpenRouterService } from '../provisioning/openrouter.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [BriefService, OpenRouterService],
  controllers: [BriefController],
})
export class BriefModule {}
