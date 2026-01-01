import type { Request } from 'express';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
export declare class BudgetsController {
    private readonly budgets;
    constructor(budgets: BudgetsService);
    createBudget(req: Request, dto: CreateBudgetDto): Promise<{
        budget: {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.BudgetStatus;
            createdAt: Date;
            createdById: string;
            approvedAt: Date | null;
            approvedById: string | null;
            fiscalYear: number;
        };
        revision: {
            id: string;
            createdAt: Date;
            createdById: string;
            revisionNo: number;
        };
    }>;
    approveBudget(req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.BudgetStatus;
        createdAt: Date;
        createdById: string;
        approvedAt: Date | null;
        approvedById: string | null;
        fiscalYear: number;
    }>;
    listBudgets(req: Request, fiscalYear?: string): Promise<{
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.BudgetStatus;
        createdAt: Date;
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
    budgetVsActualPaged(req: Request, fiscalYear?: string, periodId?: string, accountId?: string, limit?: string, offset?: string, sortBy?: string, sortDir?: string): Promise<{
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
    budgetVsActualDrilldownJournals(req: Request, accountId: string, periodId: string, limit?: string, offset?: string): Promise<{
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
    budgetVsActualMatrix(req: Request, fiscalYear?: string): Promise<{
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
    getBudget(req: Request, id: string): Promise<{
        budget: {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.BudgetStatus;
            createdAt: Date;
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
            account: {
                id: string;
                name: string;
                code: string;
            };
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
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
}
