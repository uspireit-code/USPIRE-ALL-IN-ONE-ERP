export declare class CreateCustomerInvoiceLineDto {
    accountId: string;
    description: string;
    quantity?: number;
    unitPrice: number;
}
export declare class CreateCustomerInvoiceDto {
    customerId: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    exchangeRate?: number;
    reference?: string;
    lines: CreateCustomerInvoiceLineDto[];
}
export declare class ListInvoicesQueryDto {
    status?: 'DRAFT' | 'POSTED';
    customerId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}
export declare class PostInvoiceDto {
    arControlAccountCode?: string;
}
