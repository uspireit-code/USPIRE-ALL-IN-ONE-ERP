export declare enum AccountTypeDto {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    INCOME = "INCOME",
    EXPENSE = "EXPENSE"
}
export declare class CreateAccountDto {
    code: string;
    name: string;
    type: AccountTypeDto;
    isActive?: boolean;
}
