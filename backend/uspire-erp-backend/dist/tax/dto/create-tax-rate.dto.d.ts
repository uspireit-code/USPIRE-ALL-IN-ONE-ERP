export declare class CreateTaxRateDto {
    code: string;
    name: string;
    rate: number;
    type: 'OUTPUT' | 'INPUT';
    glAccountId?: string;
}
