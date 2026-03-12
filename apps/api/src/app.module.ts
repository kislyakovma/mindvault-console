import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { BriefModule } from './brief/brief.module'
import { BillingModule } from './billing/billing.module'
import { ProvisioningModule } from './provisioning/provisioning.module'
import { SupportModule } from './support/support.module'
import { AdminModule } from './admin/admin.module'
import { VpnModule } from './vpn/vpn.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BriefModule,
    BillingModule,
    ProvisioningModule,
    SupportModule,
    AdminModule,
    VpnModule,
  ],
})
export class AppModule {}
