export declare class CreateCustomerInvoiceLineDto {
    accountId: string;
    taxRateId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
    description: string;
    quantity?: number;
    unitPrice: number;
    discountPercent?: number;
    discountAmount?: number;
}
export declare class CreateCustomerInvoiceDto {
    customerId: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    exchangeRate?: number;
    reference?: string;
    invoiceNote?: string;
    invoiceCategoryId?: string;
    projectId?: string;
    fundId?: string;
    departmentId?: string;
    lines: CreateCustomerInvoiceLineDto[];
}
export declare class UpdateCustomerInvoiceDto extends CreateCustomerInvoiceDto {
}
export declare class ListInvoicesQueryDto {
    status?: 'DRAFT' | 'POSTED';
    customerId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}
export declare class PostInvoiceDto {
}
export declare class ConfirmInvoicesImportDto {
    importId: string;
}
export declare class BulkPostInvoicesDto {
    invoiceIds: string[];
}
