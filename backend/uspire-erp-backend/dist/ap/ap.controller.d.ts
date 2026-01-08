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
                    createdById: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    isActive: boolean;
                    code: string;
                    type: import("@prisma/client").$Enums.AccountType;
                    subCategory: string | null;
                    fsMappingLevel1: string | null;
                    fsMappingLevel2: string | null;
                    isCashEquivalent: boolean;
                    requiresDepartment: boolean;
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
                } | null;
            } & {
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                isActive: boolean;
                code: string;
                type: import("@prisma/client").$Enums.TaxRateType;
                rate: import("@prisma/client/runtime/library").Decimal;
                glAccountId: string | null;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            sourceType: import("@prisma/client").$Enums.InvoiceTaxSourceType;
            sourceId: string;
            taxRateId: string;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            supplierInvoiceId: string;
        }[];
        supplier: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        postedById: string | null;
        postedAt: Date | null;
        approvedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
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
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        postedById: string | null;
        postedAt: Date | null;
        approvedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
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
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        postedById: string | null;
        postedAt: Date | null;
        approvedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
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
                id: string;
                tenantId: string;
                name: string;
                createdAt: Date;
                taxNumber: string | null;
                isActive: boolean;
            };
        } & {
            id: string;
            tenantId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            postedById: string | null;
            postedAt: Date | null;
            approvedAt: Date | null;
            supplierId: string;
            approvedById: string | null;
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
    listInvoices(req: Request): Promise<({
        lines: {
            id: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            supplierInvoiceId: string;
        }[];
        supplier: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            taxNumber: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        postedById: string | null;
        postedAt: Date | null;
        approvedAt: Date | null;
        supplierId: string;
        approvedById: string | null;
    })[]>;
}
