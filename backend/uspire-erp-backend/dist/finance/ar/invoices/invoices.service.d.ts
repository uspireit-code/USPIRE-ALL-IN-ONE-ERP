import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCustomerInvoiceDto, BulkPostInvoicesDto, ListInvoicesQueryDto } from './invoices.dto';
export declare class FinanceArInvoicesService {
    private readonly prisma;
    private readonly INVOICE_NUMBER_SEQUENCE_NAME;
    private readonly OPENING_PERIOD_NAME;
    constructor(prisma: PrismaService);
    private round2;
    private round6;
    private computeDiscount;
    private escapeHtml;
    private ensureTenant;
    private ensureUser;
    private normalizeHeaderKey;
    private parseCsvRows;
    private readXlsxRows;
    private parseYmdToDateOrNull;
    private toNum;
    private assertOpenPeriodForInvoiceDate;
    private nextInvoiceNumber;
    private computeOutstandingBalance;
    list(req: Request, q: ListInvoicesQueryDto): Promise<{
        page: number;
        pageSize: number;
        total: number;
        items: any[];
    }>;
    getById(req: Request, id: string): Promise<{
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        lines: any;
        outstandingBalance: number;
        customerId: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        exchangeRate: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        customerNameSnapshot: string;
        customerEmailSnapshot: string | null;
        customerBillingAddressSnapshot: string | null;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
    }>;
    create(req: Request, dto: CreateCustomerInvoiceDto): Promise<{
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        lines: any;
        outstandingBalance: number;
        customerId: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        exchangeRate: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        id: string;
        tenantId: string;
        invoiceNumber: string;
        customerNameSnapshot: string;
        customerEmailSnapshot: string | null;
        customerBillingAddressSnapshot: string | null;
        createdById: string;
        postedById: string | null;
        createdAt: Date;
        postedAt: Date | null;
    }>;
    post(req: Request, id: string, opts?: {
        arControlAccountCode?: string;
    }): Promise<{
        invoice: {
            subtotal: number;
            taxAmount: number;
            totalAmount: number;
            lines: any;
            outstandingBalance: number;
            customerId: string;
            invoiceDate: Date;
            dueDate: Date;
            currency: string;
            exchangeRate: import("@prisma/client/runtime/library").Decimal;
            reference: string | null;
            status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
            id: string;
            tenantId: string;
            invoiceNumber: string;
            customerNameSnapshot: string;
            customerEmailSnapshot: string | null;
            customerBillingAddressSnapshot: string | null;
            createdById: string;
            postedById: string | null;
            createdAt: Date;
            postedAt: Date | null;
        };
        glJournal: any;
    }>;
    bulkPost(req: Request, dto: BulkPostInvoicesDto): Promise<{
        postedCount: number;
        failedCount: number;
        postedInvoiceIds: string[];
        failed: {
            invoiceId: string;
            reason: string;
        }[];
    }>;
    getImportCsvTemplate(req: Request): Promise<{
        fileName: string;
        body: string;
    }>;
    getImportXlsxTemplate(req: Request): Promise<{
        fileName: string;
        body: any;
    }>;
    private readImportRows;
    previewImport(req: Request, file: any, opts?: {
        importId?: string;
    }): Promise<{
        importId: string;
        totalRows: number;
        validCount: number;
        invalidCount: number;
        rows: {
            rowNumber: number;
            invoiceRef: string;
            customerCode: string;
            invoiceDate: string;
            dueDate: string;
            revenueAccountCode: string;
            description: string;
            quantity: number;
            unitPrice: number;
            currency: string;
            errors: string[];
            _isSample: boolean;
        }[];
    }>;
    import(req: Request, file: any, importIdRaw: string): Promise<{
        totalRows: number;
        createdCount: number;
        failedCount: number;
        failedRows: {
            rowNumber: any;
            reason: any;
        }[];
    }>;
    exportInvoice(req: Request, id: string, opts: {
        format: 'html' | 'pdf';
    }): Promise<{
        fileName: string;
        contentType: string;
        body: Buffer<ArrayBufferLike>;
    } | {
        fileName: string;
        contentType: string;
        body: string;
    }>;
}
