export declare class LedgerQueryDto {
    accountId: string;
    fromDate?: string;
    toDate?: string;
    accountingPeriodId?: string;
    offset?: number;
    limit?: number;
    sourceReport?: 'TB' | 'PL' | 'BS' | 'LEDGER';
}
