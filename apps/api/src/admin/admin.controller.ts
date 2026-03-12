import { Controller, Get, Post, Delete, Patch, Put, Body, Param, Req, UseGuards, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { BillingService } from '../billing/billing.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private svc: AdminService, private billing: BillingService) {}

  @Get('users')
  listUsers(@Req() req: any, @Query('search') search?: string) {
    return this.svc.listUsers(req.user.id, search)
  }

  @Patch('users/:id/role')
  setRole(@Req() req: any, @Param('id') id: string, @Body() body: { role: 'USER' | 'ADMIN' }) {
    return this.svc.setRole(req.user.id, id, body.role)
  }

  @Post('users')
  createUser(@Req() req: any, @Body() body: { email: string; telegramUsername: string; firstName?: string; lastName?: string }) {
    return this.svc.createUser(req.user.id, body.email, body.telegramUsername, body.firstName, body.lastName)
  }

  @Delete('users/:id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteUser(req.user.id, id)
  }

  @Post('users/:id/reset-password')
  resetPassword(@Req() req: any, @Param('id') id: string) {
    return this.svc.resetPassword(req.user.id, id)
  }

  // ─── Briefs ──────────────────────────────────────────────────────────────

  @Get('users/:id/briefs')
  listBriefs(@Req() req: any, @Param('id') id: string) {
    return this.svc.listUserBriefs(req.user.id, id)
  }

  @Post('users/:id/briefs')
  createBrief(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string }) {
    return this.svc.createUserBrief(req.user.id, id, body.title || 'Бриф')
  }

  @Get('briefs/:briefId')
  getBrief(@Req() req: any, @Param('briefId') briefId: string) {
    return this.svc.getUserBrief(req.user.id, briefId)
  }

  @Put('briefs/:briefId')
  updateBrief(@Req() req: any, @Param('briefId') briefId: string, @Body() body: any) {
    const { title, ...data } = body
    return this.svc.updateUserBrief(req.user.id, briefId, data, title)
  }

  // ─── Billing ─────────────────────────────────────────────────────────────

  @Get('users/:id/balance')
  getUserBalance(@Req() req: any, @Param('id') id: string) {
    return this.svc.assertAdmin(req.user.id).then(() => this.billing.getBalance(id))
  }

  @Get('users/:id/transactions')
  getUserTransactions(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.svc.assertAdmin(req.user.id).then(() => this.billing.getTransactions(id, limit ? parseInt(limit) : 50))
  }

  @Post('users/:id/balance/adjust')
  adjustBalance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { amountKopecks: number; description: string },
  ) {
    return this.svc.assertAdmin(req.user.id).then(() =>
      this.billing.adminAdjust(id, body.amountKopecks, body.description)
    )
  }
}
