import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common'
import { ProvisioningService } from './provisioning.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@Controller('api/provisioning')
@UseGuards(JwtAuthGuard)
export class ProvisioningController {
  constructor(private svc: ProvisioningService) {}

  /**
   * Полный провижн: создать бота + задеплоить OpenClaw на VPS
   * Body: { briefId, plan? }
   */
  @Post('provision')
  provision(@Req() req: any, @Body() body: {
    briefId: string
    plan?: string
  }) {
    return this.svc.provisionAssistant({
      briefId: body.briefId,
      userId: req.user.id,
      plan: body.plan,
    })
  }
}
