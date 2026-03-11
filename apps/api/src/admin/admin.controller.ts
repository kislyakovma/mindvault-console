import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminService } from './admin.service'

@ApiTags('Admin')
@Controller('api/admin')
export class AdminController {
  constructor(private svc: AdminService) {}
}
