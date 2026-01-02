import type { Request } from 'express';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PostPaymentDto } from './dto/post-payment.dto';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentsService);
    createPayment(req: Request, dto: CreatePaymentDto): Promise<{
        bankAccount: {
            currency: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
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
        reference: string | null;
        status: import("@prisma/client").$Enums.PaymentStatus;
        id: string;
        tenantId: string;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        approvedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    approvePayment(req: Request, id: string): Promise<{
        bankAccount: {
            currency: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
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
        reference: string | null;
        status: import("@prisma/client").$Enums.PaymentStatus;
        id: string;
        tenantId: string;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        approvedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    }>;
    postPayment(req: Request, id: string, dto: PostPaymentDto): Promise<{
        payment: {
            bankAccount: {
                currency: string;
                id: string;
                tenantId: string;
                createdAt: Date;
                name: string;
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
            reference: string | null;
            status: import("@prisma/client").$Enums.PaymentStatus;
            id: string;
            tenantId: string;
            createdById: string;
            postedById: string | null;
            createdAt: Date;
            postedAt: Date | null;
            type: import("@prisma/client").$Enums.PaymentType;
            approvedById: string | null;
            approvedAt: Date | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentDate: Date;
            bankAccountId: string;
        };
        glJournal: {
            lines: {
                accountId: string;
                description: string | null;
                id: string;
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
            description: string | null;
            reference: string | null;
            status: import("@prisma/client").$Enums.JournalStatus;
            id: string;
            tenantId: string;
            createdById: string;
            postedById: string | null;
            createdAt: Date;
            postedAt: Date | null;
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
            approvedById: string | null;
            approvedAt: Date | null;
            returnedByPosterId: string | null;
            returnedByPosterAt: Date | null;
            returnReason: string | null;
            reversalOfId: string | null;
            reversalReason: string | null;
        };
    }>;
    listPayments(req: Request): Promise<({
        bankAccount: {
            currency: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
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
        reference: string | null;
        status: import("@prisma/client").$Enums.PaymentStatus;
        id: string;
        tenantId: string;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        type: import("@prisma/client").$Enums.PaymentType;
        approvedById: string | null;
        approvedAt: Date | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentDate: Date;
        bankAccountId: string;
    })[]>;
}
