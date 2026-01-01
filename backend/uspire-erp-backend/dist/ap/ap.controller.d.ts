import type { Request } from 'express';
import { ApService } from './ap.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';
export declare class ApController {
    private readonly ap;
    constructor(ap: ApService);
    createSupplier(req: Request, dto: CreateSupplierDto): Promise<{
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        taxNumber: string | null;
        isActive: boolean;
    }>;
    listSuppliers(req: Request): Promise<{
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
    createInvoice(req: Request, dto: CreateSupplierInvoiceDto): Promise<{
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
        supplier: {
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
            supplierInvoiceId: string;
        }[];
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        supplier: {
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
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        supplier: {
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
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
        postedById: string | null;
    }>;
    postInvoice(req: Request, id: string, dto: PostInvoiceDto): Promise<{
        invoice: {
            supplier: {
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
                supplierInvoiceId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            createdAt: Date;
            createdById: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            approvedAt: Date | null;
            postedAt: Date | null;
            supplierId: string;
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
        supplier: {
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
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        createdById: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
        postedById: string | null;
    })[]>;
}
