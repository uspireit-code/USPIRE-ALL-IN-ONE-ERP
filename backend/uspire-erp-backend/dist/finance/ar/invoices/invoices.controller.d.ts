import type { Request, Response } from 'express';
import { CreateCustomerInvoiceDto, ListInvoicesQueryDto, BulkPostInvoicesDto, PostInvoiceDto } from './invoices.dto';
import { FinanceArInvoicesService } from './invoices.service';
export declare class FinanceArInvoicesController {
    private readonly invoices;
    constructor(invoices: FinanceArInvoicesService);
    list(req: Request, q: ListInvoicesQueryDto): Promise<{
        page: number;
        pageSize: number;
        total: number;
        items: any[];
    }>;
    create(req: Request, dto: CreateCustomerInvoiceDto): Promise<{
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        lines: any;
        outstandingBalance: number;
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        customerId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        exchangeRate: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        invoiceNote: string | null;
        customerNameSnapshot: string;
        customerEmailSnapshot: string | null;
        customerBillingAddressSnapshot: string | null;
        postedById: string | null;
        postedAt: Date | null;
    }>;
    import(req: Request, file: any): Promise<{
        totalRows: number;
        createdCount: number;
        failedCount: number;
        failedRows: {
            rowNumber: any;
            reason: any;
        }[];
    }>;
    previewImport(req: Request, file: any): Promise<{
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
            discountPercent: any;
            discountAmount: any;
            errors: string[];
            _isSample: boolean;
        }[];
    }>;
    downloadImportCsvTemplate(req: Request, res: Response): Promise<void>;
    downloadImportXlsxTemplate(req: Request, res: Response): Promise<void>;
    getById(req: Request, id: string): Promise<{
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        lines: any;
        outstandingBalance: number;
        id: string;
        status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
        createdAt: Date;
        tenantId: string;
        createdById: string;
        customerId: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date;
        currency: string;
        exchangeRate: import("@prisma/client/runtime/library").Decimal;
        reference: string | null;
        invoiceNote: string | null;
        customerNameSnapshot: string;
        customerEmailSnapshot: string | null;
        customerBillingAddressSnapshot: string | null;
        postedById: string | null;
        postedAt: Date | null;
    }>;
    exportInvoice(req: Request, id: string, format: string, res: Response): Promise<void>;
    postInvoice(req: Request, id: string, dto: PostInvoiceDto): Promise<{
        invoice: {
            subtotal: number;
            taxAmount: number;
            totalAmount: number;
            lines: any;
            outstandingBalance: number;
            id: string;
            status: import("@prisma/client").$Enums.CustomerInvoiceStatus;
            createdAt: Date;
            tenantId: string;
            createdById: string;
            customerId: string;
            invoiceNumber: string;
            invoiceDate: Date;
            dueDate: Date;
            currency: string;
            exchangeRate: import("@prisma/client/runtime/library").Decimal;
            reference: string | null;
            invoiceNote: string | null;
            customerNameSnapshot: string;
            customerEmailSnapshot: string | null;
            customerBillingAddressSnapshot: string | null;
            postedById: string | null;
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
}
