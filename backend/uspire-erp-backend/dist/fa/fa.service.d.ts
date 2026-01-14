import type { Request } from 'express';
import { Prisma, type FixedAssetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import { CreateFixedAssetCategoryDto } from './dto/create-fa-category.dto';
import { CreateFixedAssetDto } from './dto/create-fa-asset.dto';
import { CapitalizeFixedAssetDto } from './dto/capitalize-fa-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fa-asset.dto';
export declare class FaService {
    private readonly prisma;
    private readonly gl;
    constructor(prisma: PrismaService, gl: GlService);
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
        defaultResidualRate: Prisma.Decimal | null;
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
        defaultResidualRate: Prisma.Decimal | null;
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
            defaultResidualRate: Prisma.Decimal | null;
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
        cost: Prisma.Decimal;
        residualValue: Prisma.Decimal;
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
            defaultResidualRate: Prisma.Decimal | null;
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
        cost: Prisma.Decimal;
        residualValue: Prisma.Decimal;
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
            defaultResidualRate: Prisma.Decimal | null;
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
        cost: Prisma.Decimal;
        residualValue: Prisma.Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    }>;
    runDepreciationForPeriod(req: Request, periodId: string): Promise<{
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
                amount: Prisma.Decimal;
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
            amount: Prisma.Decimal;
        }[];
    }>;
    listDepreciationRuns(req: Request): Promise<({
        lines: {
            id: string;
            tenantId: string;
            createdAt: Date;
            amount: Prisma.Decimal;
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
        cost: Prisma.Decimal;
        residualValue: Prisma.Decimal;
        usefulLifeMonths: number;
        assetAccountId: string | null;
        accumDepAccountId: string | null;
        depExpenseAccountId: string | null;
        vendorId: string | null;
        apInvoiceId: string | null;
        capitalizationJournalId: string | null;
        disposalJournalId: string | null;
    }>;
    private findGlPreparerUserId;
    private assertAccountsExist;
    getAccumulatedDepreciationToDate(params: {
        tenantId: string;
        assetId: string;
        asOf: Date;
        statusFilter?: FixedAssetStatus;
    }): Promise<Prisma.Decimal>;
}
