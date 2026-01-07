export declare class CreateFundDto {
    code: string;
    name: string;
    projectId?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isActive?: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
}
export declare class UpdateFundDto {
    code?: string;
    name?: string;
    projectId?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
}
export declare class FundIdParamDto {
    id: string;
}
