export declare class CreateRecurringTemplateLineDto {
    accountId: string;
    descriptionTemplate?: string;
    debitAmount: number;
    creditAmount: number;
    lineOrder: number;
}
export declare class CreateRecurringTemplateDto {
    name: string;
    journalType?: 'STANDARD';
    referenceTemplate: string;
    descriptionTemplate?: string;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate: string;
    endDate?: string;
    nextRunDate: string;
    isActive?: boolean;
    lines: CreateRecurringTemplateLineDto[];
}
