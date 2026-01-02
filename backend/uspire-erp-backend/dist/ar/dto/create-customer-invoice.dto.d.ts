import { InvoiceTaxLineDto } from './invoice-tax-line.dto';
export declare class CreateCustomerInvoiceLineDto {
    accountId: string;
    description: string;
    amount: number;
}
export declare class CreateCustomerInvoiceDto {
    customerId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    lines: CreateCustomerInvoiceLineDto[];
    taxLines?: InvoiceTaxLineDto[];
    arControlAccountCode?: string;
}
