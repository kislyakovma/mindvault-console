import { Module } from '@nestjs/common'
import { BriefService } from './brief.service'
import { BriefController } from './brief.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({ imports: [PrismaModule], providers: [BriefService], controllers: [BriefController] })
export class BriefModule {}
