import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BillingService } from './billing.service'

@ApiTags('Billing')
@Controller('api/billing')
export class BillingController {
  constructor(private svc: BillingService) {}
}
