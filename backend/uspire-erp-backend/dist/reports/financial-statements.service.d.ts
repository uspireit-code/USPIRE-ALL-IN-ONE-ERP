import type { Request } from 'express';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
type TrialBalanceRow = {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: number;
    totalCredit: number;
    net: number;
};
type TrialBalance = {
    from: string;
    to: string;
    totals: {
        totalDebit: number;
        totalCredit: number;
        net: number;
    };
    rows: TrialBalanceRow[];
};
type ProfitLoss = {
    from: string;
    to: string;
    income: {
        total: number;
        rows: Array<{
            accountId?: string;
            accountCode: string;
            accountName: string;
            accountType?: string;
            normalBalance?: string;
            reportSection?: string;
            balance: number;
        }>;
    };
    expenses: {
        total: number;
        rows: Array<{
            accountId?: string;
            accountCode: string;
            accountName: string;
            accountType?: string;
            normalBalance?: string;
            reportSection?: string;
            balance: number;
        }>;
    };
    profitOrLoss: number;
};
type BalanceSheet = {
    asOf: string;
    assets: {
        total: number;
        rows: Array<{
            accountId?: string;
            accountCode: string;
            accountName: string;
            accountType?: string;
            normalBalance?: string;
            reportSection?: string;
            balance: number;
        }>;
    };
    liabilities: {
        total: number;
        rows: Array<{
            accountId?: string;
            accountCode: string;
            accountName: string;
            accountType?: string;
            normalBalance?: string;
            reportSection?: string;
            balance: number;
        }>;
    };
    equity: {
        total: number;
        rows: Array<{
            accountId?: string;
            accountCode: string;
            accountName: string;
            accountType?: string;
            normalBalance?: string;
            reportSection?: string;
            balance: number;
        }>;
    };
    equation: {
        assets: number;
        liabilitiesPlusEquity: number;
        balanced: boolean;
    };
};
type Soce = {
    from: string;
    to: string;
    shareCapital: {
        opening: number;
        ownerContributions: number;
        dividendsOrDrawings: number;
        profitOrLoss: number;
        otherMovements: number;
        movements: number;
        closing: number;
    };
    retainedEarnings: {
        opening: number;
        ownerContributions: number;
        dividendsOrDrawings: number;
        profitOrLoss: number;
        otherMovements: number;
        movements: number;
        closing: number;
    };
    otherReserves: {
        opening: number;
        ownerContributions: number;
        dividendsOrDrawings: number;
        profitOrLoss: number;
        otherMovements: number;
        movements: number;
        closing: number;
    };
    totalEquity: {
        opening: number;
        ownerContributions: number;
        dividendsOrDrawings: number;
        profitOrLoss: number;
        otherMovements: number;
        movements: number;
        closing: number;
    };
};
type CashFlowIndirect = {
    from: string;
    to: string;
    operating: {
        profitBeforeTax: number;
        adjustments: Array<{
            label: string;
            amount: number;
        }>;
        workingCapital: Array<{
            label: string;
            amount: number;
        }>;
        netCashFromOperating: number;
    };
    investing: {
        rows: Array<{
            label: string;
            amount: number;
        }>;
        netCashFromInvesting: number;
    };
    financing: {
        rows: Array<{
            label: string;
            amount: number;
        }>;
        netCashFromFinancing: number;
    };
    cash: {
        openingCash: number;
        closingCash: number;
        netChangeInCash: number;
    };
};
export declare class FinancialStatementsService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    private readonly OPENING_PERIOD_NAME;
    private round2;
    private utcDateOnly;
    private addUtcDays;
    private parseDateOnly;
    private getCutoverDateIfLocked;
    private assertPeriodCoverage;
    private normalizeFromToWithCutover;
    computeTrialBalance(req: Request, params: {
        from: string;
        to: string;
    }): Promise<TrialBalance>;
    computeProfitAndLoss(req: Request, params: {
        from: string;
        to: string;
    }): Promise<ProfitLoss>;
    private computeProfitAndLossUncached;
    private retainedEarnings;
    private classifyShareCapital;
    private classifyOtherReservesEquityAccount;
    private classifyDividendsOrDrawingsEquityAccount;
    private classifyRetainedEarningsEquityAccount;
    private classifyAccumulatedDepreciationAccount;
    private classifyIntangibleAccount;
    private classifyLongTermInvestmentAccount;
    private classifyDeferredTaxAssetAccount;
    private classifyAllowanceForDoubtfulDebtsAccount;
    private classifyArControlOrTradeReceivableAccount;
    private classifyVatReceivableAccount;
    private classifyOtherReceivableAccount;
    private classifyApControlOrTradePayableAccount;
    private classifyVatPayableAccount;
    private classifyAccrualLiabilityAccount;
    private classifyDeferredIncomeLiabilityAccount;
    private classifyDeferredTaxLiabilityAccount;
    private classifyLongTermBorrowingsAccount;
    computeBalanceSheet(req: Request, params: {
        asOf: string;
    }): Promise<BalanceSheet>;
    private computeBalanceSheetUncached;
    computeSOCE(req: Request, params: {
        from: string;
        to: string;
    }): Promise<Soce>;
    private classifyCashAccount;
    private classifyDepreciationExpense;
    private classifyWorkingCapital;
    private classifyInterestIncome;
    private classifyInterestExpense;
    private classifyImpairmentOrBadDebtsExpense;
    private classifyPpeAccount;
    private classifyBorrowingsAccount;
    private classifyDividendsAccount;
    private balanceByAccountAsOf;
    computeCashFlowIndirect(req: Request, params: {
        from: string;
        to: string;
    }): Promise<CashFlowIndirect>;
}
export {};
