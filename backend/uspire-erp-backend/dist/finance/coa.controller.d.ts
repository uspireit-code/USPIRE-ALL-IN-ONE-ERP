import type { Request } from 'express';
import type { Response } from 'express';
import { CreateCoaAccountDto, UpdateCoaAccountDto } from './coa.dto';
import { CoaService } from './coa.service';
export declare class CoaController {
    private readonly coa;
    constructor(coa: CoaService);
    list(req: Request): Promise<{
        coaFrozen: boolean;
        coaLockedAt: Date | null;
        accounts: {
            name: string;
            id: string;
            tenantId: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            createdById: string | null;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            ifrsMappingCode: string | null;
            isFrozen: boolean;
            isPosting: boolean;
            parentAccountId: string | null;
            hierarchyPath: string | null;
            isControlAccount: boolean;
            isPostingAllowed: boolean;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
            isBudgetRelevant: boolean;
        }[];
    }>;
    tree(req: Request): Promise<{
        coaFrozen: boolean;
        coaLockedAt: Date | null;
        tree: any[];
    }>;
    create(req: Request, dto: CreateCoaAccountDto): Promise<{
        name: string;
        id: string;
        tenantId: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        ifrsMappingCode: string | null;
        isFrozen: boolean;
        isPosting: boolean;
        parentAccountId: string | null;
        hierarchyPath: string | null;
        isControlAccount: boolean;
        isPostingAllowed: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isBudgetRelevant: boolean;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        subCategory: string | null;
    }>;
    importCanonical(req: Request, file: any): Promise<{
        fileName: string;
        canonicalHash: string;
        rowCount: number;
        created: number;
        updated: number;
        warnings: string[];
    }>;
    importTemplate(req: Request, format: string | undefined, res: Response): Promise<void>;
    get(req: Request, id: string): Promise<{
        name: string;
        id: string;
        tenantId: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        ifrsMappingCode: string | null;
        isFrozen: boolean;
        isPosting: boolean;
        parentAccountId: string | null;
        hierarchyPath: string | null;
        isControlAccount: boolean;
        isPostingAllowed: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isBudgetRelevant: boolean;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        subCategory: string | null;
    }>;
    cleanupNonCanonical(req: Request, dto: {
        canonicalHash?: string;
        dryRun?: boolean;
    }): Promise<{
        canonicalHash: string | null;
        dryRun: boolean;
        wouldDeleteCount: number;
        wouldDelete: never[];
        blocked: never[];
        deletedCount?: undefined;
        blockedCount?: undefined;
    } | {
        canonicalHash: string | null;
        dryRun: true;
        wouldDeleteCount: number;
        wouldDelete: {
            accountCode: string;
            name: string;
            reason: string;
        }[];
        blocked: {
            accountCode: string;
            name: string;
            referencedBy: string[];
        }[];
        deletedCount?: undefined;
        blockedCount?: undefined;
    } | {
        canonicalHash: string | null;
        dryRun: false;
        deletedCount: number;
        blockedCount: number;
        blocked: {
            accountCode: string;
            name: string;
            referencedBy: string[];
        }[];
        wouldDeleteCount?: undefined;
        wouldDelete?: undefined;
    }>;
    setupTaxControlAccounts(req: Request): Promise<{
        createdCount: number;
        createdAccountIds: string[];
    }>;
    update(req: Request, id: string, dto: UpdateCoaAccountDto): Promise<{
        name: string;
        id: string;
        tenantId: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        ifrsMappingCode: string | null;
        isFrozen: boolean;
        isPosting: boolean;
        parentAccountId: string | null;
        hierarchyPath: string | null;
        isControlAccount: boolean;
        isPostingAllowed: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isBudgetRelevant: boolean;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        subCategory: string | null;
    }>;
    put(req: Request, id: string, dto: UpdateCoaAccountDto): Promise<{
        name: string;
        id: string;
        tenantId: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        ifrsMappingCode: string | null;
        isFrozen: boolean;
        isPosting: boolean;
        parentAccountId: string | null;
        hierarchyPath: string | null;
        isControlAccount: boolean;
        isPostingAllowed: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isBudgetRelevant: boolean;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        subCategory: string | null;
    }>;
    freeze(req: Request): Promise<{
        id: string;
        coaFrozen: boolean;
    }>;
    unfreeze(req: Request): Promise<{
        id: string;
        coaFrozen: boolean;
    }>;
    lock(req: Request): Promise<{
        id: string;
        coaLockedAt: Date | null;
    }>;
    unlock(req: Request): Promise<{
        id: string;
        coaLockedAt: Date | null;
    }>;
}
