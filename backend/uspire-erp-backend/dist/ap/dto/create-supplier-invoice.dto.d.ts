import { InvoiceTaxLineDto } from './invoice-tax-line.dto';
export declare class CreateSupplierInvoiceLineDto {
    accountId: string;
    description: string;
    amount: number;
}
export declare class CreateSupplierInvoiceDto {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    lines: CreateSupplierInvoiceLineDto[];
    taxLines?: InvoiceTaxLineDto[];
    apControlAccountCode?: string;
}
