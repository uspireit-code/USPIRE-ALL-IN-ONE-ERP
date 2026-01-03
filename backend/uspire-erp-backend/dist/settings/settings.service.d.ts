import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from '../storage/storage.provider';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ValidateUserRolesDto } from './dto/validate-user-roles.dto';
export declare class SettingsService {
    private readonly prisma;
    private readonly storage;
    constructor(prisma: PrismaService, storage: StorageProvider);
    private ensureAdminCoaPermissions;
    private ensureFinanceManagerRole;
    private ensureFinanceControllerRole;
    listRolesWithPermissions(req: Request): Promise<{
        id: string;
        name: string;
        description: string | null;
        intendedUsers: string | null;
        badges: {
            canApprove: boolean;
            readOnly: boolean;
            admin: boolean;
        };
        permissions: {
            module: string;
            items: {
                label: string;
                explanation: string;
            }[];
        }[];
        controlRules: string[];
    }[]>;
    getRoleDetails(req: Request, id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        intendedUsers: string | null;
        permissions: {
            module: string;
            items: {
                label: string;
                explanation: string;
                allowed: boolean;
            }[];
        }[];
        controlRules: string[];
    }>;
    listUsers(req: Request): Promise<{
        id: string;
        name: string;
        email: string;
        status: "ACTIVE" | "INACTIVE";
        roles: {
            id: string;
            name: string;
        }[];
        createdAt: Date;
    }[]>;
    listRoles(req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        description: string | null;
    }[]>;
    validateRoles(req: Request, dto: ValidateUserRolesDto): Promise<{
        valid: boolean;
        conflicts: {
            permissionA: string;
            permissionB: string;
        }[];
    }>;
    createUser(req: Request, dto: CreateUserDto): Promise<{
        id: string;
        name: string;
        email: string;
        status: "ACTIVE" | "INACTIVE";
        createdAt: Date;
        temporaryPassword: string;
    }>;
    updateUserStatus(req: Request, id: string, dto: UpdateUserStatusDto): Promise<{
        id: string;
        name: string;
        email: string;
        status: "ACTIVE" | "INACTIVE";
        createdAt: Date;
    }>;
    updateUserRoles(req: Request, id: string, dto: UpdateUserRolesDto): Promise<{
        userId: string;
        roles: {
            id: string;
            name: string;
        }[];
    }>;
    private applyUserRoles;
    private countActiveAdminsExcludingUser;
    private findSoDConflictForRoles;
    getOrganisation(req: Request): Promise<{
        logoUrl: string | null;
        id: string;
        organisationName: string;
        organisationShortName: string | null;
        primaryColor: string;
        secondaryColor: string | null;
        updatedAt: Date;
    }>;
    getSystemConfig(req: Request): Promise<any>;
    updateSystemConfig(req: Request, dto: UpdateSystemConfigDto): Promise<any>;
    uploadTenantFavicon(req: Request, file?: any): Promise<{
        faviconUrl: string;
    }>;
    downloadTenantFavicon(req: Request): Promise<{
        body: Buffer<ArrayBufferLike>;
        mimeType: string;
        fileName: string;
    }>;
    updateOrganisation(req: Request, dto: UpdateOrganisationDto): Promise<{
        logoUrl: string | null;
        id: string;
        organisationName: string;
        organisationShortName: string | null;
        primaryColor: string;
        secondaryColor: string | null;
        updatedAt: Date;
    }>;
    uploadOrganisationLogo(req: Request, file?: any): Promise<{
        logoUrl: string;
    }>;
    downloadOrganisationLogo(req: Request): Promise<{
        body: Buffer<ArrayBufferLike>;
        mimeType: string;
        fileName: string;
    }>;
}
