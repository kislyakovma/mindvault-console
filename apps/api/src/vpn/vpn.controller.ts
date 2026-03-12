import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { VpnService } from './vpn.service'
import { JwtAuthGuard } from '../auth/jwt.guard'

@ApiTags('VPN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/vpn')
export class VpnController {
  constructor(private svc: VpnService) {}

  @Get('certs')
  list(@Req() req: any) {
    return this.svc.listCerts(req.user.id)
  }

  @Post('certs')
  issue(@Req() req: any, @Body() body: { name: string }) {
    return this.svc.issueCert(req.user.id, body.name)
  }

  @Post('certs/:id/revoke')
  revoke(@Req() req: any, @Param('id') id: string) {
    return this.svc.revokeCert(req.user.id, id)
  }

  @Get('certs/:id/config')
  config(@Req() req: any, @Param('id') id: string) {
    return this.svc.getCertConfig(req.user.id, id)
  }
}
