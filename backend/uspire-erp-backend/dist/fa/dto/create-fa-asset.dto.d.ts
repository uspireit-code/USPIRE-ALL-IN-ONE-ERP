export declare enum DepreciationMethodDto {
    STRAIGHT_LINE = "STRAIGHT_LINE"
}
export declare class CreateFixedAssetDto {
    categoryId: string;
    name: string;
    description?: string;
    acquisitionDate: string;
    cost: string;
    residualValue: string;
    usefulLifeMonths: number;
    method: DepreciationMethodDto;
    vendorId?: string;
    apInvoiceId?: string;
}
