import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PERMISSIONS } from './permission-catalog';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('rbac-example')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  @Get('finance/gl')
  @Permissions(PERMISSIONS.GL.VIEW)
  getFinanceGlExample() {
    return { ok: true };
  }
}
