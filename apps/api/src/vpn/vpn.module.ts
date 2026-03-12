import { Module } from '@nestjs/common'
import { VpnService } from './vpn.service'
import { VpnController } from './vpn.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({ imports: [PrismaModule], providers: [VpnService], controllers: [VpnController] })
export class VpnModule {}
