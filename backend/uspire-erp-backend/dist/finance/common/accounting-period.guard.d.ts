import { PrismaService } from '../../prisma/prisma.service';
export type AccountingPeriodGuardAction = 'create' | 'post';
export declare function assertPeriodIsOpen(params: {
    prisma: PrismaService;
    tenantId: string;
    date: Date;
    action: AccountingPeriodGuardAction;
    documentLabel: string;
    dateLabel?: string;
}): Promise<{
    id: string;
    name: string;
    status: import("@prisma/client").$Enums.AccountingPeriodStatus;
    code: string | null;
}>;
