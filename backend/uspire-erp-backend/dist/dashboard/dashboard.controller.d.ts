import type { Request } from 'express';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    constructor(dashboard: DashboardService);
    summary(req: Request, query: DashboardQueryDto): Promise<{
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
    kpis(req: Request, query: DashboardQueryDto): Promise<{
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
    trends(req: Request, query: DashboardQueryDto): Promise<{
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
