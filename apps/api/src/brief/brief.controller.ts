import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BriefService } from './brief.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Brief')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/brief')
export class BriefController {
  constructor(private svc: BriefService) {}

  @Get()
  get(@Req() req: any) {
    return this.svc.get(req.user.id)
  }

  @Put()
  save(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.svc.save(req.user.id, body)
  }

  @Get('status')
  status(@Req() req: any) {
    return this.svc.getStatus(req.user.id)
  }
}
