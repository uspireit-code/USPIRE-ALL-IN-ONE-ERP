export declare enum CoaAccountTypeDto {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    INCOME = "INCOME",
    EXPENSE = "EXPENSE"
}
export declare enum NormalBalanceDto {
    DEBIT = "DEBIT",
    CREDIT = "CREDIT"
}
export declare enum BudgetControlModeDto {
    WARN = "WARN",
    BLOCK = "BLOCK"
}
export declare class CreateCoaAccountDto {
    code: string;
    name: string;
    accountType: CoaAccountTypeDto;
    parentAccountId?: string | null;
    isPosting?: boolean;
    isPostingAllowed?: boolean;
    isControlAccount?: boolean;
    normalBalance?: NormalBalanceDto;
    isActive?: boolean;
    subCategory?: string;
    fsMappingLevel1?: string;
    fsMappingLevel2?: string;
    isBudgetRelevant?: boolean;
    budgetControlMode?: BudgetControlModeDto;
}
export declare class UpdateCoaAccountDto {
    code?: string;
    name?: string;
    accountType?: CoaAccountTypeDto;
    parentAccountId?: string | null;
    isPosting?: boolean;
    isPostingAllowed?: boolean;
    isControlAccount?: boolean;
    normalBalance?: NormalBalanceDto;
    isActive?: boolean;
    subCategory?: string;
    fsMappingLevel1?: string;
    fsMappingLevel2?: string;
    ifrsMappingCode?: string;
    isBudgetRelevant?: boolean;
    budgetControlMode?: BudgetControlModeDto;
}
