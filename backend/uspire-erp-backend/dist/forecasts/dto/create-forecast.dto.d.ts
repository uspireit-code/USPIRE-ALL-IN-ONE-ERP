export declare class CreateForecastLineDto {
    accountId: string;
    month: number;
    amount: number;
}
export declare class CreateForecastDto {
    fiscalYear: number;
    name: string;
    lines: CreateForecastLineDto[];
}
