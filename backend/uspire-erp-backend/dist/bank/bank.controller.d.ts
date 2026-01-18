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
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            isCashEquivalent: boolean;
            createdById: string | null;
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
        name: string;
        bankName: string;
        accountNumber: string;
        currency: string;
        isActive: boolean;
        createdAt: Date;
        tenantId: string;
        glAccountId: string;
    }>;
    listBankAccounts(req: Request): Promise<({
        glAccount: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            tenantId: string;
            updatedAt: Date;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            isCashEquivalent: boolean;
            createdById: string | null;
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
        name: string;
        bankName: string;
        accountNumber: string;
        currency: string;
        isActive: boolean;
        createdAt: Date;
        tenantId: string;
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
