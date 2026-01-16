import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
export declare class TaxService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createTaxRate(req: Request, dto: CreateTaxRateDto): Promise<any>;
    listTaxRates(req: Request): Promise<({
        glAccount: {
            name: string;
            id: string;
            tenantId: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            createdById: string | null;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            isCashEquivalent: boolean;
            ifrsMappingCode: string | null;
            isFrozen: boolean;
            isPosting: boolean;
            parentAccountId: string | null;
            hierarchyPath: string | null;
            isControlAccount: boolean;
            isPostingAllowed: boolean;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            requiresFund: boolean;
            requiresProject: boolean;
            budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
            isBudgetRelevant: boolean;
            fsMappingLevel1: string | null;
            fsMappingLevel2: string | null;
            subCategory: string | null;
            requiresDepartment: boolean;
        } | null;
    } & {
        name: string;
        id: string;
        tenantId: string;
        isActive: boolean;
        createdAt: Date;
        code: string;
        type: import("@prisma/client").$Enums.TaxRateType;
        rate: import("@prisma/client/runtime/library").Decimal;
        glAccountId: string | null;
    })[]>;
}
