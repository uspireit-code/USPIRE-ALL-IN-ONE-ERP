export declare class CreateBudgetLineDto {
    accountId: string;
    periodId: string;
    legalEntityId?: string;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
    amount: number;
}
export declare class CreateBudgetDto {
    fiscalYear: number;
    lines: CreateBudgetLineDto[];
}
