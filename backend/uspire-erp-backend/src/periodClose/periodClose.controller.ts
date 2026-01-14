import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PeriodCloseService } from './periodClose.service';

@Controller('period-close')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeriodCloseController {
  constructor(private readonly periodClose: PeriodCloseService) {}

  @Get('checklist/:periodId')
  @Permissions(PERMISSIONS.GL.VIEW)
  async getChecklist(@Req() req: Request, @Param('periodId') periodId: string) {
    return this.periodClose.getChecklist(req, periodId);
  }

  @Post('checklist/:periodId/items/:itemId/complete')
  @Permissions(PERMISSIONS.PERIOD.REVIEW)
  async completeItem(
    @Req() req: Request,
    @Param('periodId') periodId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.periodClose.completeItem(req, { periodId, itemId });
  }
}
