import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ProvisioningService } from './provisioning.service'

@ApiTags('Provisioning')
@Controller('api/provisioning')
export class ProvisioningController {
  constructor(private svc: ProvisioningService) {}
}
