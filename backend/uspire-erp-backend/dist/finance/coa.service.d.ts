import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoaAccountDto, UpdateCoaAccountDto } from './coa.dto';
type RequestContext = Request;
export declare class CoaService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private normalizeHeader;
    private normalizeHeaderKey;
    private parseCsvRows;
    private readXlsxRows;
    private mapCategoryStrict;
    private mapNormalBalanceStrict;
    private parseBooleanStrict;
    private computeCanonicalHash;
    private mapCategoryToAccountType;
    private mapNormalBalance;
    private pickField;
    private getTenantCoaState;
    importCanonical(req: Request, file?: any): Promise<{
        fileName: string;
        canonicalHash: string;
        rowCount: number;
        created: number;
        updated: number;
        warnings: string[];
    }>;
    getImportTemplate(req: Request, params: {
        format?: string;
    }): Promise<{
        fileName: string;
        contentType: string;
        body: Buffer<ArrayBufferLike>;
    } | {
        fileName: string;
        contentType: string;
        body: string;
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
    private assertCoaNotFrozen;
    private assertCoaNotLocked;
    private assertParentValid;
    private assertCannotDeactivateUsedInPostedJournals;
    private assertControlAccountMayDeactivate;
    private assertNoChildren;
    private computeHierarchyPath;
    private rebuildHierarchyPaths;
    private assertNoCircularReference;
    list(req: Request): Promise<{
        coaFrozen: boolean;
        coaLockedAt: Date | null;
        accounts: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            isBudgetRelevant: boolean;
            budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
            isActive: boolean;
            parentAccountId: string | null;
            isPosting: boolean;
            isPostingAllowed: boolean;
            isControlAccount: boolean;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            hierarchyPath: string | null;
            isFrozen: boolean;
            ifrsMappingCode: string | null;
            createdById: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        subCategory: string | null;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        isBudgetRelevant: boolean;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isActive: boolean;
        parentAccountId: string | null;
        isPosting: boolean;
        isPostingAllowed: boolean;
        isControlAccount: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        hierarchyPath: string | null;
        isFrozen: boolean;
        ifrsMappingCode: string | null;
        createdById: string | null;
    }>;
    setupTaxControlAccounts(req: RequestContext): Promise<{
        createdCount: number;
        createdAccountIds: string[];
    }>;
    get(req: Request, id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        subCategory: string | null;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        isBudgetRelevant: boolean;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isActive: boolean;
        parentAccountId: string | null;
        isPosting: boolean;
        isPostingAllowed: boolean;
        isControlAccount: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        hierarchyPath: string | null;
        isFrozen: boolean;
        ifrsMappingCode: string | null;
        createdById: string | null;
    }>;
    update(req: Request, id: string, dto: UpdateCoaAccountDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        code: string;
        type: import("@prisma/client").$Enums.AccountType;
        subCategory: string | null;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        isBudgetRelevant: boolean;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        isActive: boolean;
        parentAccountId: string | null;
        isPosting: boolean;
        isPostingAllowed: boolean;
        isControlAccount: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        hierarchyPath: string | null;
        isFrozen: boolean;
        ifrsMappingCode: string | null;
        createdById: string | null;
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
export {};
