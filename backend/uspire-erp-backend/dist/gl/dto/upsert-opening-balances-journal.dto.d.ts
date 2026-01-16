export declare class UpsertOpeningBalancesJournalLineDto {
    accountId: string;
    debit: number;
    credit: number;
}
export declare class UpsertOpeningBalancesJournalDto {
    cutoverDate: string;
    lines: UpsertOpeningBalancesJournalLineDto[];
}
