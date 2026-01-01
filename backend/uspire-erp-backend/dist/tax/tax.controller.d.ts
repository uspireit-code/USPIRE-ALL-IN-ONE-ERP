import type { Request } from 'express';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { TaxService } from './tax.service';
export declare class TaxController {
    private readonly tax;
    constructor(tax: TaxService);
    createTaxRate(req: Request, dto: CreateTaxRateDto): Promise<{
        glAccount: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            subCategory: string | null;
            fsMappingLevel1: string | null;
            fsMappingLevel2: string | null;
            isCashEquivalent: boolean;
            requiresProject: boolean;
            requiresFund: boolean;
            isBudgetRelevant: boolean;
            budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
            parentAccountId: string | null;
            isPosting: boolean;
            isPostingAllowed: boolean;
            isControlAccount: boolean;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            hierarchyPath: string | null;
            isFrozen: boolean;
            ifrsMappingCode: string | null;
            createdById: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        type: import("@prisma/client").$Enums.TaxRateType;
        rate: import("@prisma/client/runtime/library").Decimal;
        glAccountId: string;
    }>;
    listTaxRates(req: Request): Promise<({
        glAccount: {
            id: string;
            tenantId: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            isActive: boolean;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            subCategory: string | null;
            fsMappingLevel1: string | null;
            fsMappingLevel2: string | null;
            isCashEquivalent: boolean;
            requiresProject: boolean;
            requiresFund: boolean;
            isBudgetRelevant: boolean;
            budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
            parentAccountId: string | null;
            isPosting: boolean;
            isPostingAllowed: boolean;
            isControlAccount: boolean;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            hierarchyPath: string | null;
            isFrozen: boolean;
            ifrsMappingCode: string | null;
            createdById: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        type: import("@prisma/client").$Enums.TaxRateType;
        rate: import("@prisma/client/runtime/library").Decimal;
        glAccountId: string;
    })[]>;
}
