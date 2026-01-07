import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import type { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';
export declare class PeriodsService {
    private readonly prisma;
    private readonly gl;
    constructor(prisma: PrismaService, gl: GlService);
    listPeriods(req: Request): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }[]>;
    createPeriod(req: Request, dto: CreateAccountingPeriodDto): Promise<any>;
    getChecklist(req: Request, id: string): Promise<{
        period: {
            name: string;
            id: string;
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
    completeChecklistItem(req: Request, params: {
        periodId: string;
        itemId: string;
    }): Promise<{
        id: any;
        code: any;
        label: any;
        required: boolean;
        completed: boolean;
        completedAt: any;
        completedBy: any;
        createdAt: any;
    }>;
    closePeriod(req: Request, id: string): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    reopenPeriod(req: Request, id: string, dto: {
        reason?: string;
    }): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        createdById: string | null;
        code: string | null;
        type: import("@prisma/client").$Enums.AccountingPeriodType;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
}
