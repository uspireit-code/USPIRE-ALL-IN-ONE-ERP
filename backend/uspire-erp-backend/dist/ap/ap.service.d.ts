import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
export declare class ApService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private round2;
    createSupplier(req: Request, dto: CreateSupplierDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        taxNumber: string | null;
    }>;
    listSuppliers(req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        taxNumber: string | null;
    }[]>;
    listEligibleAccounts(req: Request): Promise<{
        id: string;
        name: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
    }[]>;
    createInvoice(req: Request, dto: CreateSupplierInvoiceDto): Promise<{
        taxLines: ({
            taxRate: {
                glAccount: {
                    id: string;
                    tenantId: string;
                    createdById: string | null;
                    createdAt: Date;
                    name: string;
                    updatedAt: Date;
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
                };
            } & {
                id: string;
                tenantId: string;
                createdAt: Date;
                name: string;
                type: import("@prisma/client").$Enums.TaxRateType;
                isActive: boolean;
                rate: import("@prisma/client/runtime/library").Decimal;
                glAccountId: string;
            };
        } & {
            id: string;
            tenantId: string;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            createdAt: Date;
            sourceType: import("@prisma/client").$Enums.InvoiceTaxSourceType;
            sourceId: string;
            taxRateId: string;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            accountId: string;
            description: string;
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
        invoiceDate: Date;
        dueDate: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            accountId: string;
            description: string;
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        invoiceDate: Date;
        dueDate: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            accountId: string;
            description: string;
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        invoiceDate: Date;
        dueDate: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    postInvoice(req: Request, id: string, opts?: {
        apControlAccountCode?: string;
    }): Promise<{
        invoice: {
            supplier: {
                id: string;
                tenantId: string;
                createdAt: Date;
                name: string;
                isActive: boolean;
                taxNumber: string | null;
            };
            lines: {
                accountId: string;
                description: string;
                id: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                supplierInvoiceId: string;
            }[];
        } & {
            invoiceDate: Date;
            dueDate: Date;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            id: string;
            tenantId: string;
            invoiceNumber: string;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            createdById: string;
            postedById: string | null;
            createdAt: Date;
            postedAt: Date | null;
            approvedById: string | null;
            approvedAt: Date | null;
            supplierId: string;
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
    private validateTaxLines;
    private assertTaxIntegrityBeforeSubmit;
    listInvoices(req: Request): Promise<({
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            accountId: string;
            description: string;
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        invoiceDate: Date;
        dueDate: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    })[]>;
    private assertInvoiceLines;
}
