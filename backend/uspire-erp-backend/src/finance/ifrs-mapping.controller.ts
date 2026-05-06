import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { IfrsMappingService } from './ifrs-mapping.service';

@Controller('finance/ifrs-mappings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfrsMappingController {
  constructor(private readonly ifrs: IfrsMappingService) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async list(@Req() req: Request, @Query('accountType') accountType?: string) {
    return this.ifrs.list(req, { accountType });
  }
}
