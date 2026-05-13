import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GovernanceAnalyticsService } from './governance-analytics.service';

@Controller('governance/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GovernanceAnalyticsController {
  constructor(private readonly analytics: GovernanceAnalyticsService) {}

  @Get('kpis')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.GOVERNANCE.AUTOMATION.ANALYTICS,
  )
  async listKpis() {
    return this.analytics.listKpis();
  }

  @Post('kpis/summary')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.GOVERNANCE.AUTOMATION.ANALYTICS,
  )
  async summaries(
    @Req() req: Request,
    @Body()
    body: {
      kpiCodes?: string[];
      from: string;
      to: string;
      filters?: any;
    },
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.analytics.getKpiSummaries({
      tenantId: tenant.id,
      query: {
        kpiCodes: Array.isArray(body?.kpiCodes) ? body.kpiCodes : undefined,
        from: String(body?.from ?? ''),
        to: String(body?.to ?? ''),
        filters: body?.filters ?? undefined,
      },
    });
  }

  @Post('kpis/trend')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.GOVERNANCE.AUTOMATION.ANALYTICS,
  )
  async trend(
    @Req() req: Request,
    @Body()
    body: {
      kpiCode: string;
      from: string;
      to: string;
      bucket: 'DAY' | 'WEEK' | 'MONTH';
      filters?: any;
    },
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.analytics.getKpiTrend({
      tenantId: tenant.id,
      query: {
        kpiCode: String(body?.kpiCode ?? '').trim(),
        from: String(body?.from ?? ''),
        to: String(body?.to ?? ''),
        bucket: body?.bucket ?? 'DAY',
        filters: body?.filters ?? undefined,
      },
    });
  }

  @Get('kpis/drill')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.GOVERNANCE.AUTOMATION.ANALYTICS,
  )
  async drill(
    @Req() req: Request,
    @Query('kpiCode') kpiCode: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('take') take?: string,
    @Query('automationCode') automationCode?: string,
    @Query('overrideCode') overrideCode?: string,
    @Query('governanceDomain') governanceDomain?: string,
    @Query('severity') severity?: string,
    @Query('actorType') actorType?: string,
    @Query('lifecycleState') lifecycleState?: string,
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.analytics.drillThrough({
      tenantId: tenant.id,
      kpiCode: String(kpiCode ?? '').trim(),
      from: String(from ?? ''),
      to: String(to ?? ''),
      take: take ? Number(take) : undefined,
      filters: {
        ...(automationCode ? { automationCode: String(automationCode) } : {}),
        ...(overrideCode ? { overrideCode: String(overrideCode) } : {}),
        ...(governanceDomain ? { governanceDomain: String(governanceDomain) } : {}),
        ...(severity ? { severity: String(severity) } : {}),
        ...(actorType ? { actorType: String(actorType) } : {}),
        ...(lifecycleState ? { lifecycleState: String(lifecycleState) } : {}),
      },
    });
  }

  @Get('health')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.GOVERNANCE.AUTOMATION.ANALYTICS,
  )
  async health() {
    return { ok: true };
  }
}
