import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../rbac/jwt-auth.guard';
import { Permissions } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { ArAgingService } from './ar-aging.service';

@Controller('ar/aging')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArAgingController {
  constructor(private readonly aging: ArAgingService) {}

  @Get()
  @Permissions('AR_AGING_VIEW')
  async get(
    @Req() req: Request,
    @Query('asOf') asOf?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.aging.getAging(req, { asOf, customerId });
  }
}
