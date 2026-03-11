import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BriefService } from './brief.service'

@ApiTags('Brief')
@Controller('api/brief')
export class BriefController {
  constructor(private svc: BriefService) {}
}
