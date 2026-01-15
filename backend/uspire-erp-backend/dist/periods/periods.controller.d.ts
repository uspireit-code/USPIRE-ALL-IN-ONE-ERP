import type { Request } from 'express';
import { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';
import { ReopenPeriodDto } from '../gl/dto/reopen-period.dto';
import { PeriodsService } from './periods.service';
import { CorrectPeriodDto } from './dto/correct-period.dto';
export declare class PeriodsController {
    private readonly periods;
    constructor(periods: PeriodsService);
    list(req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        updatedAt: Date;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }[]>;
    create(req: Request, dto: CreateAccountingPeriodDto): Promise<any>;
    getChecklist(req: Request, id: string): Promise<{
        period: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
            closedAt: Date | null;
            closedBy: {
                id: string;
                email: string;
            } | null;
        };
        items: any;
        summary: {
            requiredTotal: any;
            requiredCompleted: number;
            requiredOutstanding: any;
            readyToClose: boolean;
        };
    }>;
    completeChecklistItem(req: Request, id: string, itemId: string): Promise<{
        id: any;
        code: any;
        label: any;
        required: boolean;
        completed: boolean;
        completedAt: any;
        completedBy: any;
        createdAt: any;
    }>;
    close(req: Request, id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        updatedAt: Date;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    reopen(req: Request, id: string, dto: ReopenPeriodDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        updatedAt: Date;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    correct(req: Request, id: string, dto: CorrectPeriodDto): Promise<any>;
}
