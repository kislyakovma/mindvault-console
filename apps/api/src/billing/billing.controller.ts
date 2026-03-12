import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BillingService } from './billing.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/billing')
export class BillingController {
  constructor(private svc: BillingService) {}

  @Get('balance')
  getBalance(@Req() req: any) {
    return this.svc.getBalance(req.user.id)
  }

  @Get('transactions')
  getTransactions(@Req() req: any, @Query('limit') limit?: string) {
    return this.svc.getTransactions(req.user.id, limit ? parseInt(limit) : 20)
  }

  @Get('subscriptions')
  listSubs(@Req() req: any) {
    return this.svc.listSubs(req.user.id)
  }

  @Post('subscriptions')
  subscribe(@Req() req: any, @Body() body: { briefId: string; plan?: string }) {
    return this.svc.subscribe(req.user.id, body.briefId, body.plan ?? 'PLUS')
  }

  @Delete('subscriptions/:id')
  cancelSub(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelSub(req.user.id, id)
  }
}
