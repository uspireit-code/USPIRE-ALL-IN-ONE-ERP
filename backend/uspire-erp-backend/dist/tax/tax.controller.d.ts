import type { Request } from 'express';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { TaxService } from './tax.service';
export declare class TaxController {
    private readonly tax;
    constructor(tax: TaxService);
    createTaxRate(req: Request, dto: CreateTaxRateDto): Promise<any>;
    listTaxRates(req: Request): Promise<({
        glAccount: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
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
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        tenantId: string;
        code: string;
        type: import("@prisma/client").$Enums.TaxRateType;
        rate: import("@prisma/client/runtime/library").Decimal;
        glAccountId: string | null;
    })[]>;
}
