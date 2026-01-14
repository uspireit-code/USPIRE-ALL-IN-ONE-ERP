export declare class CreateCustomerCreditNoteLineDto {
    description: string;
    quantity?: number;
    unitPrice: number;
    revenueAccountId: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
}
export declare class CreateCustomerCreditNoteDto {
    customerId: string;
    invoiceId?: string;
    creditNoteDate: string;
    currency: string;
    exchangeRate?: number;
    memo?: string;
    lines: CreateCustomerCreditNoteLineDto[];
}
export declare class ListCreditNotesQueryDto {
    status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'VOID';
    customerId?: string;
    invoiceId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}
export declare class ApproveCreditNoteDto {
    memo?: string;
}
export declare class SubmitCreditNoteDto {
    memo?: string;
}
export declare class PostCreditNoteDto {
}
export declare class VoidCreditNoteDto {
    reason: string;
}
