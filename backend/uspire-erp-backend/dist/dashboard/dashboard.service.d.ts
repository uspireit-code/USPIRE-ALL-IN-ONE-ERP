import type { Request } from 'express';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialStatementsService } from '../reports/financial-statements.service';
import { ReportsService } from '../reports/reports.service';
import { BudgetsService } from '../budgets/budgets.service';
import { ForecastsService } from '../forecasts/forecasts.service';
export declare class DashboardService {
    private readonly prisma;
    private readonly cache;
    private readonly financial;
    private readonly reports;
    private readonly budgets;
    private readonly forecasts;
    constructor(prisma: PrismaService, cache: CacheService, financial: FinancialStatementsService, reports: ReportsService, budgets: BudgetsService, forecasts: ForecastsService);
    private readonly OPENING_PERIOD_NAME;
    private round2;
    private dateOnlyIso;
    private parseAsOf;
    private resolveContext;
    auditDashboardView(req: Request, params: {
        dashboardType: string;
        context: {
            asOf: string;
            fiscalYear: number;
        };
    }): Promise<void>;
    private computeCashBalance;
    private computeForecastVsActualYtd;
    private computeBudgetVsActualYtd;
    getKpis(req: Request, query: {
        asOf?: string;
        fiscalYear?: number;
    }): Promise<{
        context: {
            asOf: string;
            fiscalYear: number;
        };
        kpis: {
            revenue: {
                ytd: number;
                mtd: number;
            };
            expenses: {
                ytd: number;
                mtd: number;
            };
            netProfit: {
                ytd: number;
                mtd: number;
            };
            budgetVsActualYtd: {
                budgetId: string;
                budgetTotalYtd: number;
                actualTotalYtd: number;
                varianceAmountYtd: number;
                variancePercentYtd: number | null;
            } | {
                budgetId: string | null;
                budgetTotalYtd: number | null;
                actualTotalYtd: number | null;
                varianceAmountYtd: number | null;
                variancePercentYtd: number | null;
            };
            forecastVsActualYtd: {
                forecastId: string | null;
                forecastTotalYtd: number | null;
                actualTotalYtd: number | null;
                varianceAmountYtd: number | null;
                variancePercentYtd: number | null;
            };
            cashBalance: number;
            arBalance: any;
            apBalance: any;
        };
    }>;
    getTrends(req: Request, query: {
        asOf?: string;
        fiscalYear?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        context: {
            asOf: string;
            fiscalYear: number;
        };
        byMonth: {
            month: number;
            revenue: number | null;
            expenses: number | null;
            profit: number | null;
        }[];
    }>;
}
