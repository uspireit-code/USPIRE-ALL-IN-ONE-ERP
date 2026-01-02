import type { Request } from 'express';
import { PeriodCloseService } from './periodClose.service';
export declare class PeriodCloseController {
    private readonly periodClose;
    constructor(periodClose: PeriodCloseService);
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
    completeItem(req: Request, periodId: string, itemId: string): Promise<{
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
