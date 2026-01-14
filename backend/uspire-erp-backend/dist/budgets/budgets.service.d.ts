import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
export declare class BudgetsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private readonly OPENING_PERIOD_NAME;
    private round2;
    private utcDateOnly;
    private addUtcDays;
    private assertPeriodCoverage;
    private getCutoverDateIfLocked;
    private toNum;
    private varianceStatusFromBudgetActual;
    budgetVsActualPaged(req: Request, query: {
        fiscalYear?: number;
        periodId?: string;
        accountId?: string;
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortDir?: string;
    }): Promise<{
        fiscalYear: number;
        budgetId: string;
        revision: {
            id: string;
            revisionNo: number;
            createdAt: Date;
        };
        cutoverDate: string | null;
        rows: {
            accountId: string;
            accountCode: string;
            accountName: string;
            accountType: string;
            periodId: string;
            periodName: string;
            budgetAmount: number;
            actualAmount: number;
            varianceAmount: number;
            variancePercent: number | null;
            varianceStatus: "OK" | "WARN" | "OVER";
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    budgetVsActualJournals(req: Request, params: {
        accountId: string;
        periodId: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        account: {
            id: string;
            code: string;
            name: string;
        };
        period: {
            id: string;
            name: string;
            startDate: Date;
            endDate: Date;
        };
        rows: {
            journalEntryId: string;
            journalNumber: any;
            journalDate: Date;
            reference: string | null;
            description: string | null;
            postedAt: Date | null;
            amount: number;
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    createBudget(req: Request, dto: CreateBudgetDto): Promise<{
        budget: {
            id: string;
            tenantId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.BudgetStatus;
            approvedAt: Date | null;
            approvedById: string | null;
            fiscalYear: number;
        };
        revision: {
            id: string;
            createdById: string;
            createdAt: Date;
            revisionNo: number;
        };
    }>;
    approveBudget(req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.BudgetStatus;
        approvedAt: Date | null;
        approvedById: string | null;
        fiscalYear: number;
    }>;
    listBudgets(req: Request, query?: {
        fiscalYear?: number;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.BudgetStatus;
        createdBy: {
            id: string;
            email: string;
        };
        approvedAt: Date | null;
        approvedBy: {
            id: string;
            email: string;
        } | null;
        fiscalYear: number;
    }[]>;
    getBudget(req: Request, id: string): Promise<{
        budget: {
            id: string;
            tenantId: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.BudgetStatus;
            createdBy: {
                id: string;
                email: string;
            };
            approvedAt: Date | null;
            approvedBy: {
                id: string;
                email: string;
            } | null;
            fiscalYear: number;
        };
        revisions: {
            id: string;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            revisionNo: number;
        }[];
        latestRevision: {
            id: string;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            revisionNo: number;
        };
        lines: {
            id: string;
            account: {
                id: string;
                name: string;
                code: string;
            };
            amount: Prisma.Decimal;
            accountId: string;
            periodId: string;
            period: {
                id: string;
                name: string;
                startDate: Date;
                endDate: Date;
            };
        }[];
    }>;
    budgetVsActual(req: Request, query?: {
        fiscalYear?: number;
    }): Promise<{
        fiscalYear: number;
        budgetId: string;
        revision: {
            id: string;
            revisionNo: number;
            createdAt: Date;
        };
        periods: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
        }[];
        rows: never[];
        totalsByPeriodId: {};
        cutoverDate?: undefined;
        from?: undefined;
        to?: undefined;
    } | {
        fiscalYear: number;
        budgetId: string;
        revision: {
            id: string;
            revisionNo: number;
            createdAt: Date;
        };
        cutoverDate: string | null;
        from: string;
        to: string;
        periods: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
        }[];
        rows: {
            accountId: string;
            accountCode: string;
            accountName: string;
            accountType: string;
            byPeriodId: Record<string, {
                budget: number;
                actual: number;
                variance: number;
                variancePct: number | null;
            }>;
            totals: {
                budget: number;
                actual: number;
                variance: number;
                variancePct: number | null;
            };
        }[];
        totalsByPeriodId: Record<string, {
            budget: number;
            actual: number;
            variance: number;
            variancePct: number | null;
        }>;
    }>;
}
