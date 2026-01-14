export declare class CreateProjectDto {
    code: string;
    name: string;
    status?: 'ACTIVE' | 'CLOSED';
    isRestricted?: boolean;
    isActive?: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
}
export declare class UpdateProjectDto {
    code?: string;
    name?: string;
    status?: 'ACTIVE' | 'CLOSED';
    isRestricted?: boolean;
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
}
export declare class ProjectIdParamDto {
    id: string;
}
