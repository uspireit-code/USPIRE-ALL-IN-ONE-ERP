import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GlService } from './gl.service';

@Controller('gl/risk')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GlRiskController {
  constructor(private readonly gl: GlService) {}

  @Get('overview')
  @Permissions('FINANCE_GL_VIEW')
  async overview(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('projectId') projectId?: string,
    @Query('fundId') fundId?: string,
  ) {
    return this.gl.getJournalRiskOverview(req, {
      periodId,
      dateFrom,
      dateTo,
      legalEntityId,
      departmentId,
      projectId,
      fundId,
    });
  }

  @Get('users')
  @Permissions('FINANCE_GL_VIEW')
  async users(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.gl.getJournalRiskUsers(req, { periodId, dateFrom, dateTo });
  }

  @Get('accounts')
  @Permissions('FINANCE_GL_VIEW')
  async accounts(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('projectId') projectId?: string,
    @Query('fundId') fundId?: string,
  ) {
    return this.gl.getJournalRiskAccounts(req, {
      periodId,
      dateFrom,
      dateTo,
      legalEntityId,
      departmentId,
      projectId,
      fundId,
    });
  }

  @Get('organisation')
  @Permissions('FINANCE_GL_VIEW')
  async organisation(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.gl.getJournalRiskOrganisation(req, {
      periodId,
      dateFrom,
      dateTo,
    });
  }

  @Get('periods')
  @Permissions('FINANCE_GL_VIEW')
  async periods(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.gl.getJournalRiskPeriods(req, { periodId, dateFrom, dateTo });
  }
}
