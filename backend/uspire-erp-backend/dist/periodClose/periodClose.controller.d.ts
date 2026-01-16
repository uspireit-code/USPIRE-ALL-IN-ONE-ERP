import type { Request } from 'express';
import { PeriodCloseService } from './periodClose.service';
export declare class PeriodCloseController {
    private readonly periodClose;
    constructor(periodClose: PeriodCloseService);
    getChecklist(req: Request, periodId: string): Promise<{
        period: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        };
        checklist: {
            id: string;
            createdAt: Date;
            periodId: string;
            items: {
                name: string;
                id: string;
                createdAt: Date;
                status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
                code: string;
                completedAt: Date | null;
                completedBy: {
                    email: string;
                    id: string;
                } | null;
            }[];
        };
    }>;
    completeItem(req: Request, periodId: string, itemId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PeriodCloseChecklistItemStatus;
        code: string;
        completedAt: Date | null;
        completedBy: {
            email: string;
            id: string;
        } | null;
    }>;
}
