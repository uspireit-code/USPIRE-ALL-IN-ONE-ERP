export declare class BankStatementLineInputDto {
    transactionDate: string;
    description: string;
    amount: number;
    reference?: string;
}
export declare class AddBankStatementLinesDto {
    lines: BankStatementLineInputDto[];
}
