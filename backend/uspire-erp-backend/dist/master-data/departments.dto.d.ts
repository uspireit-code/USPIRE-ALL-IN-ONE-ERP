export declare class CreateDepartmentDto {
    code: string;
    name: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isActive?: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
}
export declare class UpdateDepartmentDto {
    code?: string;
    name?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
}
export declare class DepartmentIdParamDto {
    id: string;
}
