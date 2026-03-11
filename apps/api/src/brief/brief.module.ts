import { Module } from '@nestjs/common'
import { BriefService } from './brief.service'
import { BriefController } from './brief.controller'

@Module({ providers: [BriefService], controllers: [BriefController] })
export class BriefModule {}
