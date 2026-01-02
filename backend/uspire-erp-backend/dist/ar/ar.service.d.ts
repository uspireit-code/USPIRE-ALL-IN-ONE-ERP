import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
export declare class ArService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private round2;
    createCustomer(req: Request, dto: CreateCustomerDto): Promise<any>;
    listCustomers(req: Request): Promise<any>;
    listEligibleAccounts(req: Request): Promise<{
        name: string;
        id: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
    }[]>;
    createInvoice(req: Request, dto: CreateCustomerInvoiceDto): Promise<{
        taxLines: ({
            taxRate: {
                glAccount: {
                    name: string;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    tenantId: string;
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
                    isActive: boolean;
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
                name: string;
                id: string;
                createdAt: Date;
                tenantId: string;
                type: import("@prisma/client").$Enums.TaxRateType;
                isActive: boolean;
                rate: import("@prisma/client/runtime/library").Decimal;
                glAccountId: string;
            };
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            sourceType: import("@prisma/client").$Enums.InvoiceTaxSourceType;
            sourceId: string;
            taxRateId: string;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
        customer: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            customerCode: string | null;
            email: string | null;
            phone: string | null;
            billingAddress: string | null;
            taxNumber: string | null;
        };
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        customerId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
        customer: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            customerCode: string | null;
            email: string | null;
            phone: string | null;
            billingAddress: string | null;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        customerId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
        customer: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            customerCode: string | null;
            email: string | null;
            phone: string | null;
            billingAddress: string | null;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        customerId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    postInvoice(req: Request, id: string, opts?: {
        arControlAccountCode?: string;
    }): Promise<{
        invoice: {
            lines: {
                id: string;
                description: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                accountId: string;
                customerInvoiceId: string;
            }[];
            customer: {
                name: string;
                id: string;
                status: import("@prisma/client").$Enums.CustomerStatus;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                customerCode: string | null;
                email: string | null;
                phone: string | null;
                billingAddress: string | null;
                taxNumber: string | null;
            };
        } & {
            id: string;
            status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
            createdAt: Date;
            tenantId: string;
            createdById: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            currency: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            approvedAt: Date | null;
            postedAt: Date | null;
            customerId: string;
            approvedById: string | null;
            postedById: string | null;
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
    private validateTaxLines;
    private assertTaxIntegrityBeforeSubmit;
    listInvoices(req: Request): Promise<({
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            customerInvoiceId: string;
        }[];
        customer: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            customerCode: string | null;
            email: string | null;
            phone: string | null;
            billingAddress: string | null;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        customerId: string;
        approvedById: string | null;
        postedById: string | null;
    })[]>;
    private assertInvoiceLines;
}
