import type { Request, Response } from 'express';
import { SettingsService } from './settings.service';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ValidateUserRolesDto } from './dto/validate-user-roles.dto';
export declare class SettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
    getOrganisation(req: Request): Promise<{
        logoUrl: string | null;
        id: string;
        organisationName: string;
        organisationShortName: string | null;
        primaryColor: string;
        secondaryColor: string | null;
        updatedAt: Date;
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
    uploadLogo(req: Request, file: any): Promise<{
        logoUrl: string;
    }>;
    downloadLogo(req: Request, res: Response): Promise<void>;
    getSystemConfig(req: Request): Promise<{
        logoUrl: string | null;
        faviconUrl: string | null;
        id: string;
        name: string;
        organisationName: string;
        organisationShortName: string | null;
        primaryColor: string;
        secondaryColor: string | null;
        legalName: string | null;
        defaultCurrency: string | null;
        country: string | null;
        timezone: string | null;
        financialYearStartMonth: number | null;
        dateFormat: string | null;
        numberFormat: string | null;
        defaultLandingPage: string | null;
        defaultDashboard: string | null;
        defaultLanguage: string | null;
        demoModeEnabled: boolean | null;
        defaultUserRoleCode: string | null;
        accentColor: string | null;
        secondaryAccentColor: string | null;
        updatedAt: Date;
    }>;
    updateSystemConfig(req: Request, dto: UpdateSystemConfigDto): Promise<{
        logoUrl: string | null;
        faviconUrl: string | null;
        id: string;
        name: string;
        organisationName: string;
        organisationShortName: string | null;
        primaryColor: string;
        secondaryColor: string | null;
        legalName: string | null;
        defaultCurrency: string | null;
        country: string | null;
        timezone: string | null;
        financialYearStartMonth: number | null;
        dateFormat: string | null;
        numberFormat: string | null;
        defaultLandingPage: string | null;
        defaultDashboard: string | null;
        defaultLanguage: string | null;
        demoModeEnabled: boolean | null;
        defaultUserRoleCode: string | null;
        accentColor: string | null;
        secondaryAccentColor: string | null;
        updatedAt: Date;
    }>;
    uploadFavicon(req: Request, file: any): Promise<{
        faviconUrl: string;
    }>;
    downloadFavicon(req: Request, res: Response): Promise<void>;
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
}
