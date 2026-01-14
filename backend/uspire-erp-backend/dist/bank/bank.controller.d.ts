import type { Request } from 'express';
import { BankService } from './bank.service';
import { AddBankStatementLinesDto } from './dto/add-bank-statement-lines.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankStatementDto } from './dto/create-bank-statement.dto';
import { ListBankStatementsQueryDto } from './dto/list-bank-statements-query.dto';
import { MatchBankReconciliationDto } from './dto/match-bank-reconciliation.dto';
import { ReconciliationStatusQueryDto } from './dto/reconciliation-status-query.dto';
export declare class BankController {
    private readonly bank;
    constructor(bank: BankService);
    createBankAccount(req: Request, dto: CreateBankAccountDto): Promise<{
        glAccount: {
            id: string;
            tenantId: string;
            createdById: string | null;
            createdAt: Date;
            isActive: boolean;
            name: string;
            updatedAt: Date;
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
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        isActive: boolean;
        name: string;
        bankName: string;
        accountNumber: string;
        currency: string;
        glAccountId: string;
    }>;
    listBankAccounts(req: Request): Promise<({
        glAccount: {
            id: string;
            tenantId: string;
            createdById: string | null;
            createdAt: Date;
            isActive: boolean;
            name: string;
            updatedAt: Date;
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
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        isActive: boolean;
        name: string;
        bankName: string;
        accountNumber: string;
        currency: string;
        glAccountId: string;
    })[]>;
    createStatement(req: Request, dto: CreateBankStatementDto): Promise<any>;
    listStatements(req: Request, dto: ListBankStatementsQueryDto): Promise<any>;
    getStatement(req: Request, id: string): Promise<any>;
    addStatementLines(req: Request, id: string, dto: AddBankStatementLinesDto): Promise<{
        createdCount: any;
    }>;
    unmatched(req: Request): Promise<{
        unreconciledPayments: any;
        unreconciledStatementLines: any;
    }>;
    match(req: Request, dto: MatchBankReconciliationDto): Promise<{
        reconciliation: any;
    }>;
    status(req: Request, dto: ReconciliationStatusQueryDto): Promise<{
        bankAccountId: string;
        totalStatementLines: any;
        reconciledCount: any;
        unreconciledCount: number;
    }>;
}
