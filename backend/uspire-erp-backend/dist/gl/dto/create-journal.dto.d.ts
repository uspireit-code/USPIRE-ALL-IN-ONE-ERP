export declare class CreateJournalLineDto {
    lineNumber?: number;
    accountId: string;
    legalEntityId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
    description?: string;
    debit: number;
    credit: number;
}
export declare class CreateJournalDto {
    journalDate: string;
    journalType?: 'STANDARD' | 'ADJUSTING' | 'ACCRUAL' | 'REVERSING';
    reference?: string;
    description?: string;
    correctsJournalId?: string;
    lines: CreateJournalLineDto[];
}
