import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SupportService } from './support.service'

@ApiTags('Support')
@Controller('api/support')
export class SupportController {
  constructor(private svc: SupportService) {}
}
