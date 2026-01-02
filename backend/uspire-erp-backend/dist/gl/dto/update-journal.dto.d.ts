export declare class UpdateJournalLineDto {
    lineNumber?: number;
    accountId: string;
    legalEntityId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
    description?: string;
    budgetOverrideJustification?: string;
    debit: number;
    credit: number;
}
export declare class UpdateJournalDto {
    journalDate: string;
    journalType?: 'STANDARD' | 'ADJUSTING' | 'ACCRUAL' | 'REVERSING';
    reference?: string;
    description?: string;
    lines: UpdateJournalLineDto[];
}
