import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('users')
  listUsers(@Req() req: any) {
    return this.svc.listUsers(req.user.id)
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
}
