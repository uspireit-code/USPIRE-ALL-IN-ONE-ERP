export declare class UpdateRecurringTemplateLineDto {
    accountId: string;
    descriptionTemplate?: string;
    debitAmount: number;
    creditAmount: number;
    lineOrder: number;
}
export declare class UpdateRecurringTemplateDto {
    name?: string;
    journalType?: 'STANDARD';
    referenceTemplate?: string;
    descriptionTemplate?: string;
    frequency?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate?: string;
    endDate?: string | null;
    nextRunDate?: string;
    isActive?: boolean;
    lines?: UpdateRecurringTemplateLineDto[];
}
