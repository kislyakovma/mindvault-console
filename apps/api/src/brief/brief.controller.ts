import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common'
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
  list(@Req() req: any) {
    return this.svc.list(req.user.id)
  }

  @Post()
  create(@Req() req: any, @Body() body: { title: string }) {
    return this.svc.create(req.user.id, body.title || 'Мой бриф')
  }

  @Get('status')
  status(@Req() req: any) {
    return this.svc.getStatusForDashboard(req.user.id)
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(req.user.id, id)
  }

  @Put(':id')
  save(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.svc.save(req.user.id, id, body)
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.svc.delete(req.user.id, id)
  }
}
