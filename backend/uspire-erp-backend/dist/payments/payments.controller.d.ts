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
            isActive: boolean;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            isActive: boolean;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    }>;
    postPayment(req: Request, id: string, dto: PostPaymentDto): Promise<{
        payment: {
            bankAccount: {
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                isActive: boolean;
                glAccountId: string;
                bankName: string;
                accountNumber: string;
                currency: string;
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
            status: import("@prisma/client").$Enums.PaymentStatus;
            createdAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            type: import("@prisma/client").$Enums.PaymentType;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            reference: string | null;
            bankAccountId: string;
            paymentDate: Date;
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
            tenantId: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            description: string | null;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
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
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            isActive: boolean;
            glAccountId: string;
            bankName: string;
            accountNumber: string;
            currency: string;
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
        status: import("@prisma/client").$Enums.PaymentStatus;
        createdAt: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        type: import("@prisma/client").$Enums.PaymentType;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        reference: string | null;
        bankAccountId: string;
        paymentDate: Date;
    })[]>;
}
