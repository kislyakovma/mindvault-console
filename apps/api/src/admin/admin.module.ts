import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminService } from './admin.service'
import { AdminController } from './admin.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
