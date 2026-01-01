import type { Request } from 'express';
import { ArService } from './ar.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
import { PostCustomerInvoiceDto } from './dto/post-customer-invoice.dto';
export declare class ArController {
    private readonly ar;
    constructor(ar: ArService);
    createCustomer(req: Request, dto: CreateCustomerDto): Promise<{
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        taxNumber: string | null;
        isActive: boolean;
    }>;
    listCustomers(req: Request): Promise<{
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        taxNumber: string | null;
        isActive: boolean;
    }[]>;
    listEligibleAccounts(req: Request): Promise<{
        id: string;
        name: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
    }[]>;
    createInvoice(req: Request, dto: CreateCustomerInvoiceDto): Promise<{
        taxLines: ({
            taxRate: {
                glAccount: {
                    id: string;
                    tenantId: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    isActive: boolean;
                    code: string;
                    type: import("@prisma/client").$Enums.AccountType;
                    subCategory: string | null;
                    fsMappingLevel1: string | null;
                    fsMappingLevel2: string | null;
                    isCashEquivalent: boolean;
                    requiresProject: boolean;
                    requiresFund: boolean;
                    isBudgetRelevant: boolean;
                    budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
                    parentAccountId: string | null;
                    isPosting: boolean;
                    isPostingAllowed: boolean;
                    isControlAccount: boolean;
                    normalBalance: import("@prisma/client").$Enums.NormalBalance;
                    hierarchyPath: string | null;
                    isFrozen: boolean;
                    ifrsMappingCode: string | null;
                    createdById: string | null;
                };
            } & {
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                isActive: boolean;
                type: import("@prisma/client").$Enums.TaxRateType;
                rate: import("@prisma/client/runtime/library").Decimal;
                glAccountId: string;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            sourceType: import("@prisma/client").$Enums.InvoiceTaxSourceType;
            sourceId: string;
            taxRateId: string;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        customer: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        customerId: string;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        customer: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        customerId: string;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        customer: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        customerId: string;
    }>;
    postInvoice(req: Request, id: string, dto: PostCustomerInvoiceDto): Promise<{
        invoice: {
            customer: {
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                taxNumber: string | null;
                isActive: boolean;
            };
            lines: {
                id: string;
                description: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                accountId: string;
                customerInvoiceId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
            createdAt: Date;
            createdById: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            customerId: string;
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
    listInvoices(req: Request): Promise<({
        customer: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        customerId: string;
    })[]>;
}
