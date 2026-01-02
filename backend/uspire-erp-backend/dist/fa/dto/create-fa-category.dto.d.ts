export declare enum DepreciationMethodDto {
    STRAIGHT_LINE = "STRAIGHT_LINE"
}
export declare class CreateFixedAssetCategoryDto {
    code: string;
    name: string;
    defaultMethod: DepreciationMethodDto;
    defaultUsefulLifeMonths: number;
    defaultResidualRate?: string;
    assetAccountId: string;
    accumDepAccountId: string;
    depExpenseAccountId: string;
}
