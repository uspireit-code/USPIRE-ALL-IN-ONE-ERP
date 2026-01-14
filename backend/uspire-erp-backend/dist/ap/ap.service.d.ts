import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import type { StorageProvider } from '../storage/storage.provider';
import { UploadSupplierDocumentDto } from './dto/upload-supplier-document.dto';
import { CreateSupplierBankAccountDto } from './dto/create-supplier-bank-account.dto';
import { UpdateSupplierBankAccountDto } from './dto/update-supplier-bank-account.dto';
export declare class ApService {
    private readonly prisma;
    private readonly storage;
    constructor(prisma: PrismaService, storage: StorageProvider);
    private round2;
    private assertActiveSupplier;
    private createSupplierChangeLog;
    listSupplierDocuments(req: Request, supplierId: string): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        docType: string;
        filename: string;
        mimeType: string;
        storageKey: string;
        fileSize: number | null;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        isActive: boolean;
    }[]>;
    uploadSupplierDocument(req: Request, supplierId: string, dto: UploadSupplierDocumentDto, file?: any): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        docType: string;
        filename: string;
        mimeType: string;
        storageKey: string;
        fileSize: number | null;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        isActive: boolean;
    }>;
    deactivateSupplierDocument(req: Request, supplierId: string, docId: string): Promise<{
        ok: boolean;
    }>;
    downloadSupplierDocument(req: Request, supplierId: string, docId: string): Promise<{
        fileName: string;
        mimeType: string;
        size: number;
        body: Buffer<ArrayBufferLike>;
    }>;
    listSupplierBankAccounts(req: Request, supplierId: string): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        bankName: string;
        branchName: string | null;
        accountName: string;
        accountNumber: string;
        currency: string | null;
        swiftCode: string | null;
        isPrimary: boolean;
        updatedById: string | null;
    }[]>;
    createSupplierBankAccount(req: Request, supplierId: string, dto: CreateSupplierBankAccountDto): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        bankName: string;
        branchName: string | null;
        accountName: string;
        accountNumber: string;
        currency: string | null;
        swiftCode: string | null;
        isPrimary: boolean;
        updatedById: string | null;
    }>;
    updateSupplierBankAccount(req: Request, supplierId: string, bankId: string, dto: UpdateSupplierBankAccountDto): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        bankName: string;
        branchName: string | null;
        accountName: string;
        accountNumber: string;
        currency: string | null;
        swiftCode: string | null;
        isPrimary: boolean;
        updatedById: string | null;
    }>;
    deactivateSupplierBankAccount(req: Request, supplierId: string, bankId: string): Promise<{
        ok: boolean;
    }>;
    setPrimarySupplierBankAccount(req: Request, supplierId: string, bankId: string): Promise<{
        ok: boolean;
    }>;
    listSupplierChangeHistory(req: Request, supplierId: string): Promise<{
        id: string;
        tenantId: string;
        supplierId: string;
        createdAt: Date;
        changeType: string;
        field: string | null;
        oldValue: string | null;
        newValue: string | null;
        refId: string | null;
        actorUserId: string;
    }[]>;
    createSupplier(req: Request, dto: CreateSupplierDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        isActive: boolean;
        name: string;
        taxNumber: string | null;
    }>;
    listSuppliers(req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        isActive: boolean;
        name: string;
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
                    isActive: boolean;
                    name: string;
                    updatedAt: Date;
                    code: string;
                    type: import("@prisma/client").$Enums.AccountType;
                    isCashEquivalent: boolean;
                    ifrsMappingCode: string | null;
                    isFrozen: boolean;
                    isPosting: boolean;
                    parentAccountId: string | null;
                    hierarchyPath: string | null;
                    isControlAccount: boolean;
                    isPostingAllowed: boolean;
                    normalBalance: import("@prisma/client").$Enums.NormalBalance;
                    requiresFund: boolean;
                    requiresProject: boolean;
                    budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
                    isBudgetRelevant: boolean;
                    fsMappingLevel1: string | null;
                    fsMappingLevel2: string | null;
                    subCategory: string | null;
                    requiresDepartment: boolean;
                } | null;
            } & {
                id: string;
                tenantId: string;
                createdAt: Date;
                isActive: boolean;
                name: string;
                code: string;
                type: import("@prisma/client").$Enums.TaxRateType;
                rate: import("@prisma/client/runtime/library").Decimal;
                glAccountId: string | null;
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
            createdAt: Date;
            isActive: boolean;
            name: string;
            taxNumber: string | null;
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
        supplierId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
    }>;
    submitInvoice(req: Request, id: string): Promise<{
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            isActive: boolean;
            name: string;
            taxNumber: string | null;
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
        supplierId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
    }>;
    approveInvoice(req: Request, id: string): Promise<{
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            isActive: boolean;
            name: string;
            taxNumber: string | null;
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
        supplierId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
    }>;
    postInvoice(req: Request, id: string, opts?: {
        apControlAccountCode?: string;
    }): Promise<{
        invoice: {
            supplier: {
                id: string;
                tenantId: string;
                createdAt: Date;
                isActive: boolean;
                name: string;
                taxNumber: string | null;
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
            supplierId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
        };
        glJournal: {
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                debit: import("@prisma/client/runtime/library").Decimal;
                credit: import("@prisma/client/runtime/library").Decimal;
                lineNumber: number | null;
                departmentId: string | null;
                legalEntityId: string | null;
                fundId: string | null;
                projectId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            createdById: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.JournalStatus;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            description: string | null;
            sourceType: string | null;
            sourceId: string | null;
            reference: string | null;
            journalDate: Date;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reversalOfId: string | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            submittedAt: Date | null;
            submittedById: string | null;
            rejectedAt: Date | null;
            rejectedById: string | null;
            rejectionReason: string | null;
            returnReason: string | null;
            returnedByPosterAt: Date | null;
            returnedByPosterId: string | null;
            reversalInitiatedAt: Date | null;
            reversalInitiatedById: string | null;
            reversalReason: string | null;
            reversalPreparedById: string | null;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: import("@prisma/client/runtime/library").JsonValue;
            riskComputedAt: Date | null;
            budgetCheckedAt: Date | null;
            budgetFlags: import("@prisma/client/runtime/library").JsonValue | null;
            budgetOverrideJustification: string | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        };
    }>;
    private validateTaxLines;
    private assertTaxIntegrityBeforeSubmit;
    listInvoices(req: Request): Promise<({
        supplier: {
            id: string;
            tenantId: string;
            createdAt: Date;
            isActive: boolean;
            name: string;
            taxNumber: string | null;
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
        supplierId: string;
        createdById: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.SupplierInvoiceStatus;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
    })[]>;
    private assertInvoiceLines;
}
