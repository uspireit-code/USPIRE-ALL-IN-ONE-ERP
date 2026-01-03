import type { Request } from 'express';
import { PeriodCloseService } from './periodClose.service';
export declare class PeriodCloseController {
    private readonly periodClose;
    constructor(periodClose: PeriodCloseService);
    getChecklist(req: Request, periodId: string): Promise<{
        period: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        };
        checklist: {
            id: string;
            createdAt: Date;
            periodId: string;
            items: {
                id: string;
                name: string;
                status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
                createdAt: Date;
                code: string;
                completedAt: Date | null;
                completedBy: {
                    id: string;
                    email: string;
                } | null;
            }[];
        };
    }>;
    completeItem(req: Request, periodId: string, itemId: string): Promise<{
        id: string;
        name: string;
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
