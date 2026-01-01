import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { BudgetsService } from '../budgets/budgets.service';
import { ForecastsService } from '../forecasts/forecasts.service';
import { FinancialStatementsService } from '../reports/financial-statements.service';
import { ReportsService } from '../reports/reports.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    FinancialStatementsService,
    ReportsService,
    BudgetsService,
    ForecastsService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class DashboardModule {}
