import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class PeriodCloseService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getChecklist(req: Request, periodId: string): Promise<{
        period: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        };
        checklist: {
            id: string;
            createdAt: Date;
            items: {
                name: string;
                id: string;
                status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
                createdAt: Date;
                code: string;
                completedAt: Date | null;
                completedBy: {
                    id: string;
                    email: string;
                } | null;
            }[];
            periodId: string;
        };
    }>;
    completeItem(req: Request, params: {
        periodId: string;
        itemId: string;
    }): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
        createdAt: Date;
        code: string;
        completedAt: Date | null;
        completedBy: {
            id: string;
            email: string;
        } | null;
    }>;
}
