import type { Request } from 'express';
import { CapitalizeFixedAssetDto } from './dto/capitalize-fa-asset.dto';
import { CreateFixedAssetDto } from './dto/create-fa-asset.dto';
import { CreateFixedAssetCategoryDto } from './dto/create-fa-category.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fa-asset.dto';
import { FaService } from './fa.service';
export declare class FaController {
    private readonly fa;
    constructor(fa: FaService);
    listCategories(req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        code: string;
        assetAccountId: string;
        accumDepAccountId: string;
        depExpenseAccountId: string;
        defaultMethod: import("@prisma/client").$Enums.DepreciationMethod;
        defaultUsefulLifeMonths: number;
        defaultResidualRate: import("@prisma/client/runtime/library").Decimal | null;
    }[]>;
    createCategory(req: Request, dto: CreateFixedAssetCategoryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        code: string;
        assetAccountId: string;
        accumDepAccountId: string;
        depExpenseAccountId: string;
        defaultMethod: import("@prisma/client").$Enums.DepreciationMethod;
        defaultUsefulLifeMonths: number;
        defaultResidualRate: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    listAssets(req: Request): Promise<({
        category: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            code: string;
            assetAccountId: string;
            accumDepAccountId: string;
            depExpenseAccountId: string;
            defaultMethod: import("@prisma/client").$Enums.DepreciationMethod;
            defaultUsefulLifeMonths: number;
            defaultResidualRate: import("@prisma/client/runtime/library").Decimal | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.FixedAssetStatus;
        description: string | null;
        method: import("@prisma/client").$Enums.DepreciationMethod;
        categoryId: string;
        acquisitionDate: Date;
        capitalizationDate: Date | null;
        cost: import("@prisma/client/runtime/library").Decimal;
        residualValue: import("@prisma/client/runtime/library").Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    })[]>;
    createAsset(req: Request, dto: CreateFixedAssetDto): Promise<{
        category: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            code: string;
            assetAccountId: string;
            accumDepAccountId: string;
            depExpenseAccountId: string;
            defaultMethod: import("@prisma/client").$Enums.DepreciationMethod;
            defaultUsefulLifeMonths: number;
            defaultResidualRate: import("@prisma/client/runtime/library").Decimal | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.FixedAssetStatus;
        description: string | null;
        method: import("@prisma/client").$Enums.DepreciationMethod;
        categoryId: string;
        acquisitionDate: Date;
        capitalizationDate: Date | null;
        cost: import("@prisma/client/runtime/library").Decimal;
        residualValue: import("@prisma/client/runtime/library").Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    }>;
    capitalizeAsset(req: Request, id: string, dto: CapitalizeFixedAssetDto): Promise<{
        category: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            code: string;
            assetAccountId: string;
            accumDepAccountId: string;
            depExpenseAccountId: string;
            defaultMethod: import("@prisma/client").$Enums.DepreciationMethod;
            defaultUsefulLifeMonths: number;
            defaultResidualRate: import("@prisma/client/runtime/library").Decimal | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.FixedAssetStatus;
        description: string | null;
        method: import("@prisma/client").$Enums.DepreciationMethod;
        categoryId: string;
        acquisitionDate: Date;
        capitalizationDate: Date | null;
        cost: import("@prisma/client/runtime/library").Decimal;
        residualValue: import("@prisma/client/runtime/library").Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    }>;
    runDepreciation(req: Request, periodId: string): Promise<{
        run: {
            id: string;
            tenantId: string;
            periodId: string;
        };
        journalEntry: null;
        totals: Array<any>;
    } | {
        run: {
            lines: {
                id: string;
                tenantId: string;
                createdAt: Date;
                amount: import("@prisma/client/runtime/library").Decimal;
                runId: string;
                assetId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.FixedAssetDepreciationRunStatus;
            postedById: string;
            periodId: string;
            journalEntryId: string | null;
            runDate: Date;
        };
        journalEntry: any;
        totals: {
            depExpenseAccountId: string;
            accumDepAccountId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
        }[];
    }>;
    listDepreciationRuns(req: Request): Promise<({
        lines: {
            id: string;
            tenantId: string;
            createdAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            runId: string;
            assetId: string;
        }[];
        period: {
            id: string;
            tenantId: string;
            createdById: string | null;
            createdAt: Date;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            updatedAt: Date;
            code: string | null;
            type: import("@prisma/client").$Enums.AccountingPeriodType;
            startDate: Date;
            endDate: Date;
            closedById: string | null;
            closedAt: Date | null;
        };
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.FixedAssetDepreciationRunStatus;
        postedById: string;
        periodId: string;
        journalEntryId: string | null;
        runDate: Date;
    })[]>;
    disposeAsset(req: Request, id: string, dto: DisposeFixedAssetDto): Promise<{
        id: string;
        tenantId: string;
        createdById: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.FixedAssetStatus;
        description: string | null;
        method: import("@prisma/client").$Enums.DepreciationMethod;
        categoryId: string;
        acquisitionDate: Date;
        capitalizationDate: Date | null;
        cost: import("@prisma/client/runtime/library").Decimal;
        residualValue: import("@prisma/client/runtime/library").Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    }>;
}
