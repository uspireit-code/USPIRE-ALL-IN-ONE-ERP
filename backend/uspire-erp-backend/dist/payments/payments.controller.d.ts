import type { Request } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PostPaymentDto } from './dto/post-payment.dto';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    createPayment(req: Request, dto: CreatePaymentDto): Promise<{
        bankAccount: {
            name: string;
            id: string;
            tenantId: string;
            isActive: boolean;
            createdAt: Date;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        postedById: string | null;
        approvedAt: Date | null;
        postedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            name: string;
            id: string;
            tenantId: string;
            isActive: boolean;
            createdAt: Date;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        postedById: string | null;
        approvedAt: Date | null;
        postedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    postPayment(req: Request, id: string, dto: PostPaymentDto): Promise<{
        payment: {
            bankAccount: {
                name: string;
                id: string;
                tenantId: string;
                isActive: boolean;
                createdAt: Date;
                bankName: string;
                accountNumber: string;
                currency: string;
                glAccountId: string;
            };
            allocations: {
                id: string;
                sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
                sourceId: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                paymentId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.PaymentStatus;
            createdById: string;
            type: import("@prisma/client").$Enums.PaymentType;
            approvedById: string | null;
            postedById: string | null;
            approvedAt: Date | null;
            postedAt: Date | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            reference: string | null;
            paymentDate: Date;
            bankAccountId: string;
        };
        glJournal: {
            lines: {
                id: string;
                accountId: string;
                description: string | null;
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
            tenantId: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdById: string;
            sourceType: string | null;
            sourceId: string | null;
            approvedById: string | null;
            postedById: string | null;
            approvedAt: Date | null;
            postedAt: Date | null;
            description: string | null;
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
            name: string;
            id: string;
            tenantId: string;
            isActive: boolean;
            createdAt: Date;
            bankName: string;
            accountNumber: string;
            currency: string;
            glAccountId: string;
        };
        allocations: {
            id: string;
            sourceType: import("@prisma/client").$Enums.PaymentAllocationSourceType;
            sourceId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdById: string;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        postedById: string | null;
        approvedAt: Date | null;
        postedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        paymentDate: Date;
        bankAccountId: string;
    })[]>;
}
