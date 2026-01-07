export declare class CreateTaxRateDto {
    code: string;
    name: string;
    rate: number;
    type: 'OUTPUT' | 'INPUT';
    glAccountId?: string;
}
export declare class UpdateTaxRateDto {
    code?: string;
    name?: string;
    rate?: number;
    type?: 'OUTPUT' | 'INPUT';
    glAccountId?: string | null;
}
export declare class SetTaxRateActiveDto {
    isActive: boolean;
}
export declare class UpdateTenantTaxConfigDto {
    outputVatAccountId?: string | null;
    inputVatAccountId?: string | null;
}
export declare class TaxSummaryQueryDto {
    from: string;
    to: string;
}
