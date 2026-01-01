import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { TimeoutInterceptor } from '../internal/timeout.interceptor';
import { TenantRateLimitGuard } from '../internal/tenant-rate-limit.guard';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseGuards(new TenantRateLimitGuard(10_000, 30, 'dashboard'))
@UseInterceptors(new TimeoutInterceptor(10_000, 'Dashboard'))
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard.view')
  async summary(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const data = await this.dashboard.getKpis(req, query);
    await this.dashboard.auditDashboardView(req, {
      dashboardType: 'summary',
      context: data.context,
    });
    return data;
  }

  @Get('kpis')
  @Permissions('dashboard.view')
  async kpis(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const data = await this.dashboard.getKpis(req, query);
    await this.dashboard.auditDashboardView(req, {
      dashboardType: 'kpis',
      context: data.context,
    });
    return data;
  }

  @Get('trends')
  @Permissions('dashboard.view')
  async trends(@Req() req: Request, @Query() query: DashboardQueryDto) {
    const data = await this.dashboard.getTrends(req, query);
    await this.dashboard.auditDashboardView(req, {
      dashboardType: 'trends',
      context: data.context,
    });
    return data;
  }
}
