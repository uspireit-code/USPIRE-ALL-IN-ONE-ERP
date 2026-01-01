export declare class CreatePaymentAllocationDto {
    sourceType: 'SUPPLIER_INVOICE' | 'CUSTOMER_INVOICE';
    sourceId: string;
    amount: number;
}
export declare class CreatePaymentDto {
    type: 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT';
    bankAccountId: string;
    amount: number;
    paymentDate: string;
    reference?: string;
    allocations: CreatePaymentAllocationDto[];
    apControlAccountCode?: string;
    arControlAccountCode?: string;
}
