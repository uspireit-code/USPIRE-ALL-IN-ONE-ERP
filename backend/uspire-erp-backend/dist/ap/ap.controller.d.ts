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
                    createdById: string | null;
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
                    isActive: boolean;
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
                name: string;
                id: string;
                createdAt: Date;
                tenantId: string;
                code: string;
                type: import("@prisma/client").$Enums.TaxRateType;
                isActive: boolean;
                glAccountId: string | null;
                rate: import("@prisma/client/runtime/library").Decimal;
            };
        } & {
            id: string;
            createdAt: Date;
            tenantId: string;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            taxRateId: string;
            sourceType: import("@prisma/client").$Enums.InvoiceTaxSourceType;
            sourceId: string;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            id: string;
            accountId: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            id: string;
            accountId: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        supplier: {
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            id: string;
            accountId: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    }>;
    postInvoice(req: Request, id: string, dto: PostInvoiceDto): Promise<{
        invoice: {
            supplier: {
                name: string;
                id: string;
                createdAt: Date;
                tenantId: string;
                isActive: boolean;
                taxNumber: string | null;
            };
            lines: {
                id: string;
                accountId: string;
                description: string;
                amount: import("@prisma/client/runtime/library").Decimal;
                supplierInvoiceId: string;
            }[];
        } & {
            id: string;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            createdAt: Date;
            tenantId: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            createdById: string;
            postedById: string | null;
            postedAt: Date | null;
            approvedById: string | null;
            approvedAt: Date | null;
            supplierId: string;
        };
        glJournal: {
            lines: {
                id: string;
                projectId: string | null;
                fundId: string | null;
                departmentId: string | null;
                accountId: string;
                description: string | null;
                lineNumber: number | null;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                legalEntityId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            tenantId: string;
            reference: string | null;
            createdById: string;
            postedById: string | null;
            postedAt: Date | null;
            description: string | null;
            approvedById: string | null;
            approvedAt: Date | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            sourceType: string | null;
            sourceId: string | null;
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
            name: string;
            id: string;
            createdAt: Date;
            tenantId: string;
            isActive: boolean;
            taxNumber: string | null;
        };
        lines: {
            id: string;
            accountId: string;
            description: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            supplierInvoiceId: string;
        }[];
    } & {
        id: string;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        createdById: string;
        postedById: string | null;
        postedAt: Date | null;
        approvedById: string | null;
        approvedAt: Date | null;
        supplierId: string;
    })[]>;
}
