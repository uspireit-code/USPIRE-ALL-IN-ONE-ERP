import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { FinancialStatementsService } from '../reports/financial-statements.service';
import { ReportsService } from '../reports/reports.service';
import { BudgetsService } from '../budgets/budgets.service';
import { ForecastsService } from '../forecasts/forecasts.service';

type DashboardContext = {
  tenantId: string;
  userId: string;
  asOf: Date;
  fiscalYear: number;
  fyStart: Date;
  mtdStart: Date;
  mtdEnd: Date;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly financial: FinancialStatementsService,
    private readonly reports: ReportsService,
    private readonly budgets: BudgetsService,
    private readonly forecasts: ForecastsService,
  ) {}

  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private dateOnlyIso(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  private parseAsOf(asOf?: string) {
    if (!asOf) return new Date();
    const d = new Date(asOf);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException('Invalid asOf date');
    return d;
  }

  private async resolveContext(
    req: Request,
    params: { asOf?: string; fiscalYear?: number },
  ): Promise<DashboardContext> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const asOf = this.parseAsOf(params.asOf);

    const currentPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: { not: this.OPENING_PERIOD_NAME },
        startDate: { lte: asOf },
        endDate: { gte: asOf },
      },
      select: { startDate: true, endDate: true },
    });

    if (!currentPeriod) {
      throw new BadRequestException(
        'No accounting period exists for asOf date',
      );
    }

    const inferredFiscalYear = currentPeriod.startDate.getUTCFullYear();
    const fiscalYear = params.fiscalYear ?? inferredFiscalYear;

    const fyStartPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: { not: this.OPENING_PERIOD_NAME },
        startDate: {
          gte: new Date(Date.UTC(fiscalYear, 0, 1)),
          lt: new Date(Date.UTC(fiscalYear + 1, 0, 1)),
        },
      },
      orderBy: { startDate: 'asc' },
      select: { startDate: true },
    });

    if (!fyStartPeriod) {
      throw new BadRequestException(
        'No accounting periods exist for the requested fiscalYear',
      );
    }

    return {
      tenantId: tenant.id,
      userId: user.id,
      asOf,
      fiscalYear,
      fyStart: fyStartPeriod.startDate,
      mtdStart: currentPeriod.startDate,
      mtdEnd: currentPeriod.endDate,
    };
  }

  async auditDashboardView(
    req: Request,
    params: {
      dashboardType: string;
      context: { asOf: string; fiscalYear: number };
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) return;

    const entityId = `DASHBOARD:${params.dashboardType}:${params.context.fiscalYear}:${params.context.asOf}`;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'DASHBOARD_VIEW',
          entityType: 'REPORT',
          entityId,
          action: 'DASHBOARD_VIEW',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            dashboardType: params.dashboardType,
            ...params.context,
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.DASHBOARD.VIEW,
        },
      })
      .catch(() => undefined);
  }

  private async computeCashBalance(params: {
    tenantId: string;
    asOf: Date;
  }): Promise<number> {
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: params.tenantId,
        type: 'ASSET',
        isCashEquivalent: true,
        isActive: true,
      },
      select: { id: true },
    });

    if (cashAccounts.length === 0) {
      return 0;
    }

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: cashAccounts.map((a) => a.id) },
        journalEntry: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: { lte: params.asOf },
        },
      },
      _sum: { debit: true, credit: true },
    });

    let total = 0;
    for (const g of grouped) {
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);
      total += debit - credit;
    }

    return this.round2(total);
  }

  private async computeForecastVsActualYtd(
    req: Request,
    ctx: DashboardContext,
  ) {
    const forecast = await this.prisma.forecast.findFirst({
      where: {
        tenantId: ctx.tenantId,
        fiscalYear: ctx.fiscalYear,
        status: 'APPROVED',
      },
      select: { id: true },
    });

    if (!forecast) {
      return {
        forecastId: null as string | null,
        forecastTotalYtd: null as number | null,
        actualTotalYtd: null as number | null,
        varianceAmountYtd: null as number | null,
        variancePercentYtd: null as number | null,
      };
    }

    const variance = await this.forecasts.getForecastVariance(req, forecast.id);

    const monthCutoff = ctx.asOf.getUTCMonth() + 1;

    let forecastTotal = 0;
    let actualTotal = 0;

    for (const row of variance.rows) {
      for (let m = 1; m <= monthCutoff; m++) {
        const cell = row.byMonth[m];
        if (!cell) continue;
        if (cell.actualAmount === null) continue;
        forecastTotal += cell.forecastAmount;
        actualTotal += cell.actualAmount;
      }
    }

    const f = this.round2(forecastTotal);
    const a = this.round2(actualTotal);
    const varianceAmountYtd = this.round2(a - f);
    const variancePercentYtd =
      f === 0 ? null : this.round2((varianceAmountYtd / f) * 100);

    return {
      forecastId: forecast.id,
      forecastTotalYtd: f,
      actualTotalYtd: a,
      varianceAmountYtd,
      variancePercentYtd,
    };
  }

  private async computeBudgetVsActualYtd(req: Request, ctx: DashboardContext) {
    const bva = await this.budgets.budgetVsActual(req, {
      fiscalYear: ctx.fiscalYear,
    });

    const ytdPeriodIds = bva.periods
      .filter((p) => p.startDate <= ctx.asOf)
      .map((p) => p.id);

    let budgetTotal = 0;
    let actualTotal = 0;

    for (const pid of ytdPeriodIds) {
      const totals = (bva.totalsByPeriodId as any)[pid];
      if (!totals) continue;
      budgetTotal += Number(totals.budget ?? 0);
      actualTotal += Number(totals.actual ?? 0);
    }

    const budgetYtd = this.round2(budgetTotal);
    const actualYtd = this.round2(actualTotal);
    const varianceAmountYtd = this.round2(actualYtd - budgetYtd);
    const variancePercentYtd =
      budgetYtd === 0
        ? null
        : this.round2((varianceAmountYtd / budgetYtd) * 100);

    return {
      budgetId: bva.budgetId,
      budgetTotalYtd: budgetYtd,
      actualTotalYtd: actualYtd,
      varianceAmountYtd,
      variancePercentYtd,
    };
  }

  async getKpis(req: Request, query: { asOf?: string; fiscalYear?: number }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const asOfKey = query.asOf ?? '';
    const fyKey = query.fiscalYear ?? '';
    const key = `dashboard:kpis:${tenant.id}:${asOfKey}:${fyKey}`;

    return this.cache.getOrSet({
      tenantId: tenant.id,
      key,
      ttlMs: 60_000,
      loader: async () => {
        const ctx = await this.resolveContext(req, query);

        const ytdPl = await this.financial.computeProfitAndLoss(req, {
          from: this.dateOnlyIso(ctx.fyStart),
          to: this.dateOnlyIso(ctx.asOf),
        });

        const mtdPl = await this.financial.computeProfitAndLoss(req, {
          from: this.dateOnlyIso(ctx.mtdStart),
          to: this.dateOnlyIso(ctx.mtdEnd < ctx.asOf ? ctx.mtdEnd : ctx.asOf),
        });

        const cash = await this.computeCashBalance({
          tenantId: ctx.tenantId,
          asOf: ctx.asOf,
        });

        const ar = await this.reports.arAging(req, {
          asOf: this.dateOnlyIso(ctx.asOf),
        } as any);
        const ap = await this.reports.apAging(req, {
          asOf: this.dateOnlyIso(ctx.asOf),
        } as any);

        const budgetVsActualYtd = await this.computeBudgetVsActualYtd(
          req,
          ctx,
        ).catch((e) => {
          if (e instanceof NotFoundException) {
            return {
              budgetId: null as string | null,
              budgetTotalYtd: null as number | null,
              actualTotalYtd: null as number | null,
              varianceAmountYtd: null as number | null,
              variancePercentYtd: null as number | null,
            };
          }
          throw e;
        });

        const forecastVsActualYtd = await this.computeForecastVsActualYtd(
          req,
          ctx,
        );

        return {
          context: {
            asOf: this.dateOnlyIso(ctx.asOf),
            fiscalYear: ctx.fiscalYear,
          },
          kpis: {
            revenue: {
              ytd: ytdPl.income.total,
              mtd: mtdPl.income.total,
            },
            expenses: {
              ytd: ytdPl.expenses.total,
              mtd: mtdPl.expenses.total,
            },
            netProfit: {
              ytd: ytdPl.profitOrLoss,
              mtd: mtdPl.profitOrLoss,
            },
            budgetVsActualYtd,
            forecastVsActualYtd,
            cashBalance: cash,
            arBalance: (ar as any).grandTotalOutstanding ?? 0,
            apBalance: (ap as any).grandTotalOutstanding ?? 0,
          },
        };
      },
    });
  }

  async getTrends(
    req: Request,
    query: {
      asOf?: string;
      fiscalYear?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const asOfKey = query.asOf ?? '';
    const fyKey = query.fiscalYear ?? '';
    const limitKey = query.limit ?? '';
    const offsetKey = query.offset ?? '';
    const key = `dashboard:trends:${tenant.id}:${asOfKey}:${fyKey}:${limitKey}:${offsetKey}`;

    return this.cache.getOrSet({
      tenantId: tenant.id,
      key,
      ttlMs: 60_000,
      loader: async () => {
        const ctx = await this.resolveContext(req, query);

        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;
        if (limit < 1 || limit > 200)
          throw new BadRequestException(
            'Invalid limit. Limit must be between 1 and 200.',
          );
        if (offset < 0)
          throw new BadRequestException(
            'Invalid offset. Offset must be greater than or equal to 0.',
          );

        const periods = await this.prisma.accountingPeriod.findMany({
          where: {
            tenantId: ctx.tenantId,
            name: { not: this.OPENING_PERIOD_NAME },
            startDate: {
              gte: new Date(Date.UTC(ctx.fiscalYear, 0, 1)),
              lt: new Date(Date.UTC(ctx.fiscalYear + 1, 0, 1)),
            },
          },
          orderBy: { startDate: 'asc' },
          select: { startDate: true, endDate: true },
        });

        if (periods.length === 0) {
          throw new BadRequestException(
            'No accounting periods exist for the requested fiscalYear',
          );
        }

        const monthCutoff = ctx.asOf.getUTCMonth() + 1;

        const byMonth: Array<{
          month: number;
          revenue: number | null;
          expenses: number | null;
          profit: number | null;
        }> = [];

        for (const p of periods) {
          const month = p.startDate.getUTCMonth() + 1;
          if (month > 12) continue;
          if (month > monthCutoff) {
            byMonth.push({
              month,
              revenue: null,
              expenses: null,
              profit: null,
            });
            continue;
          }

          const pl = await this.financial.computeProfitAndLoss(req, {
            from: this.dateOnlyIso(p.startDate),
            to: this.dateOnlyIso(p.endDate),
          });

          byMonth.push({
            month,
            revenue: pl.income.total,
            expenses: pl.expenses.total,
            profit: pl.profitOrLoss,
          });
        }

        byMonth.sort((a, b) => a.month - b.month);
        const paged = byMonth.slice(offset, offset + limit);

        return {
          context: {
            asOf: this.dateOnlyIso(ctx.asOf),
            fiscalYear: ctx.fiscalYear,
          },
          byMonth: paged,
        };
      },
    });
  }
}
