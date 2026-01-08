import type { Request } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PostPaymentDto } from './dto/post-payment.dto';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    createPayment(req: Request, dto: CreatePaymentDto): Promise<{
        bankAccount: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            currency: string;
            isActive: boolean;
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
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        postedById: string | null;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        approvedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            currency: string;
            isActive: boolean;
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
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        postedById: string | null;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        approvedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    postPayment(req: Request, id: string, dto: PostPaymentDto): Promise<{
        payment: {
            bankAccount: {
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                currency: string;
                isActive: boolean;
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
            tenantId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.PaymentStatus;
            reference: string | null;
            postedById: string | null;
            postedAt: Date | null;
            type: import("@prisma/client").$Enums.PaymentType;
            approvedAt: Date | null;
            approvedById: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentDate: Date;
            bankAccountId: string;
        };
        glJournal: {
            lines: {
                id: string;
                projectId: string | null;
                fundId: string | null;
                departmentId: string | null;
                description: string | null;
                accountId: string;
                lineNumber: number | null;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                legalEntityId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.JournalStatus;
            reference: string | null;
            postedById: string | null;
            postedAt: Date | null;
            approvedAt: Date | null;
            approvedById: string | null;
            description: string | null;
            sourceType: string | null;
            sourceId: string | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
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
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            currency: string;
            isActive: boolean;
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
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PaymentStatus;
        reference: string | null;
        postedById: string | null;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedAt: Date | null;
        approvedById: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    })[]>;
}
