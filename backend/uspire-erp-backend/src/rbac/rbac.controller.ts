import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('rbac-example')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  @Get('finance/gl')
  @Permissions('FINANCE_GL_VIEW')
  getFinanceGlExample() {
    return { ok: true };
  }
}
