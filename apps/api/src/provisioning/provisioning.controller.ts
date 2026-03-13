import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common'
import { ProvisioningService } from './provisioning.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@Controller('api/provisioning')
@UseGuards(JwtAuthGuard)
export class ProvisioningController {
  constructor(private svc: ProvisioningService) {}

  /**
   * Полный провижн: создать бота + задеплоить OpenClaw на VPS
   * Body: { briefId, sshHost, sshPassword, openrouterKey, sshUser? }
   */
  @Post('provision')
  provision(@Req() req: any, @Body() body: {
    briefId: string
    sshHost: string
    sshPassword: string
    openrouterKey: string
    sshUser?: string
  }) {
    return this.svc.provisionAssistant({
      briefId: body.briefId,
      userId: req.user.id,
      sshHost: body.sshHost,
      sshUser: body.sshUser || 'root',
      sshPassword: body.sshPassword,
      openrouterKey: body.openrouterKey,
    })
  }
}
