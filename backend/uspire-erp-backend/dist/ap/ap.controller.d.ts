import type { Request } from 'express';
import { ApService } from './ap.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';
export declare class ApController {
    private readonly ap;
    constructor(ap: ApService);
    createSupplier(req: Request, dto: CreateSupplierDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        isActive: boolean;
        taxNumber: string | null;
    }>;
    listSuppliers(req: Request): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        tenantId: string;
        isActive: boolean;
        taxNumber: string | null;
    }[]>;
    listEligibleAccounts(req: Request): Promise<{
        name: string;
        id: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
    }[]>;
    createInvoice(req: Request, dto: CreateSupplierInvoiceDto): Promise<{
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
            supplierInvoiceId: string;
        }[];
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        supplierId: string;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            supplierInvoiceId: string;
        }[];
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        supplierId: string;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            supplierInvoiceId: string;
        }[];
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        supplierId: string;
    }>;
    postInvoice(req: Request, id: string, dto: PostInvoiceDto): Promise<{
        invoice: {
            lines: {
                id: string;
                description: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                accountId: string;
                supplierInvoiceId: string;
            }[];
            supplier: {
                name: string;
                id: string;
                createdAt: Date;
                tenantId: string;
                isActive: boolean;
                taxNumber: string | null;
            };
        } & {
            id: string;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            createdAt: Date;
            tenantId: string;
            createdById: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            supplierId: string;
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
    listInvoices(req: Request): Promise<({
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            supplierInvoiceId: string;
        }[];
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        supplierId: string;
    })[]>;
}
