import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class PeriodCloseService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getChecklist(req: Request, periodId: string): Promise<{
        period: {
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            id: string;
            name: string;
        };
        checklist: {
            id: string;
            createdAt: Date;
            items: {
                status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
                id: string;
                createdAt: Date;
                name: string;
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
        status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
        id: string;
        createdAt: Date;
        name: string;
        code: string;
        completedAt: Date | null;
        completedBy: {
            id: string;
            email: string;
        } | null;
    }>;
}
