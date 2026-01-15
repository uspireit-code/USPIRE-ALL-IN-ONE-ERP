import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
export declare class PaymentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createPayment(req: Request, dto: CreatePaymentDto): Promise<{
        bankAccount: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            paymentId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            paymentId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    }>;
    postPayment(req: Request, id: string, opts?: {
        apControlAccountCode?: string;
    }): Promise<{
        payment: {
            bankAccount: {
                id: string;
                name: string;
                isActive: boolean;
                createdAt: Date;
                tenantId: string;
                bankName: string;
                accountNumber: string;
                currency: string;
                glAccountId: string;
            };
            allocations: {
                id: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
                sourceId: string;
                paymentId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.PaymentStatus;
            createdById: string;
            type: import("@prisma/client").$Enums.PaymentType;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            reference: string | null;
            bankAccountId: string;
            paymentDate: Date;
        };
        glJournal: {
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                lineNumber: number | null;
                departmentId: string | null;
                legalEntityId: string | null;
                fundId: string | null;
                projectId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            description: string | null;
            sourceType: string | null;
            sourceId: string | null;
            reference: string | null;
            journalDate: Date;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reversalOfId: string | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            submittedAt: Date | null;
            submittedById: string | null;
            rejectedAt: Date | null;
            rejectedById: string | null;
            rejectionReason: string | null;
            returnReason: string | null;
            returnedByPosterAt: Date | null;
            returnedByPosterId: string | null;
            reversalInitiatedAt: Date | null;
            reversalInitiatedById: string | null;
            reversalReason: string | null;
            reversalPreparedById: string | null;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: import("@prisma/client/runtime/library").JsonValue;
            riskComputedAt: Date | null;
            budgetCheckedAt: Date | null;
            budgetFlags: import("@prisma/client/runtime/library").JsonValue | null;
            budgetOverrideJustification: string | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        };
    }>;
    listPayments(req: Request): Promise<({
        bankAccount: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            paymentId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    })[]>;
    private assertAllocations;
}
