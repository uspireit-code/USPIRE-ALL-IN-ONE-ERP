import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
export declare class PaymentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createPayment(req: Request, dto: CreatePaymentDto): Promise<{
        bankAccount: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            currency: string;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        tenantId: string;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            currency: string;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        tenantId: string;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    postPayment(req: Request, id: string, opts?: {
        apControlAccountCode?: string;
        arControlAccountCode?: string;
    }): Promise<{
        payment: {
            bankAccount: {
                name: string;
                id: string;
                createdAt: Date;
                tenantId: string;
                isActive: boolean;
                currency: string;
                glAccountId: string;
                bankName: string;
                accountNumber: string;
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
            status: import("@prisma/client").$Enums.PaymentStatus;
            createdAt: Date;
            tenantId: string;
            type: import("@prisma/client").$Enums.PaymentType;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            reference: string | null;
            paymentDate: Date;
            bankAccountId: string;
        };
        glJournal: {
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                lineNumber: number | null;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                legalEntityId: string | null;
                departmentId: string | null;
                projectId: string | null;
                fundId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            tenantId: string;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            description: string | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reference: string | null;
            journalDate: Date;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: import("@prisma/client/runtime/library").JsonValue;
            riskComputedAt: Date | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
            budgetFlags: import("@prisma/client/runtime/library").JsonValue | null;
            budgetCheckedAt: Date | null;
            budgetOverrideJustification: string | null;
            reversalInitiatedById: string | null;
            reversalInitiatedAt: Date | null;
            reversalPreparedById: string | null;
            submittedById: string | null;
            submittedAt: Date | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            rejectedById: string | null;
            rejectedAt: Date | null;
            rejectionReason: string | null;
            returnedByPosterId: string | null;
            returnedByPosterAt: Date | null;
            returnReason: string | null;
            reversalOfId: string | null;
            reversalReason: string | null;
        };
    }>;
    listPayments(req: Request): Promise<({
        bankAccount: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            currency: string;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        tenantId: string;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    })[]>;
    private assertAllocations;
}
