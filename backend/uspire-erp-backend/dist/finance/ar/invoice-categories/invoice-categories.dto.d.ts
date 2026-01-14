export declare class CreateInvoiceCategoryDto {
    code: string;
    name: string;
    revenueAccountId: string;
    requiresProject?: boolean;
    requiresFund?: boolean;
    requiresDepartment?: boolean;
}
export declare class UpdateInvoiceCategoryDto {
    code?: string;
    name?: string;
    revenueAccountId?: string;
    requiresProject?: boolean;
    requiresFund?: boolean;
    requiresDepartment?: boolean;
    isActive?: boolean;
}
