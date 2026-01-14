declare const REFUND_PAYMENT_METHODS: readonly ["BANK", "CASH"];
export declare class CreateCustomerRefundDto {
    customerId: string;
    creditNoteId: string;
    refundDate: string;
    currency: string;
    exchangeRate?: number;
    amount: number;
    paymentMethod: (typeof REFUND_PAYMENT_METHODS)[number];
    bankAccountId?: string;
}
export declare class SubmitRefundDto {
}
export declare class ApproveRefundDto {
}
export declare class PostRefundDto {
}
export declare class VoidRefundDto {
    reason: string;
}
export declare class ListRefundsQueryDto {
    status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'VOID';
    customerId?: string;
    creditNoteId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}
export {};
