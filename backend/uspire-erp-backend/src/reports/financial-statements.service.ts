import { BadRequestException, Injectable } from '@nestjs/common';
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
  totals: { totalDebit: number; totalCredit: number; net: number };
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
    adjustments: Array<{ label: string; amount: number }>;
    workingCapital: Array<{ label: string; amount: number }>;
    netCashFromOperating: number;
  };
  investing: {
    rows: Array<{ label: string; amount: number }>;
    netCashFromInvesting: number;
  };
  financing: {
    rows: Array<{ label: string; amount: number }>;
    netCashFromFinancing: number;
  };
  cash: {
    openingCash: number;
    closingCash: number;
    netChangeInCash: number;
  };
};

@Injectable()
export class FinancialStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private utcDateOnly(d: Date) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addUtcDays(d: Date, days: number) {
    const dd = new Date(d.getTime());
    dd.setUTCDate(dd.getUTCDate() + days);
    return dd;
  }

  private parseDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException('Invalid date');
    return d;
  }

  private async getCutoverDateIfLocked(params: {
    tenantId: string;
  }): Promise<Date | null> {
    const closed = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    return closed?.startDate ?? null;
  }

  private async assertPeriodCoverage(params: {
    tenantId: string;
    from: Date;
    to: Date;
  }) {
    const periods = await this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.to },
        endDate: { gte: params.from },
      },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true },
    });

    if (periods.length === 0)
      throw new BadRequestException(
        'No accounting periods configured for requested date range',
      );

    const from = this.utcDateOnly(params.from);
    const to = this.utcDateOnly(params.to);

    let cursor = from;

    for (const p of periods) {
      const start = this.utcDateOnly(p.startDate);
      const end = this.utcDateOnly(p.endDate);

      if (end < cursor) continue;
      if (start > cursor)
        throw new BadRequestException(
          'Accounting period coverage gap for requested date range',
        );

      cursor = this.addUtcDays(end, 1);
      if (cursor > to) return;
    }

    throw new BadRequestException(
      'Accounting period coverage gap for requested date range',
    );
  }

  private async normalizeFromToWithCutover(params: {
    tenantId: string;
    from: Date;
    to: Date;
  }) {
    let from = params.from;
    const to = params.to;

    if (from > to)
      throw new BadRequestException('from must be less than or equal to to');

    const cutover = await this.getCutoverDateIfLocked({
      tenantId: params.tenantId,
    });

    if (cutover && to < cutover) {
      return { from: cutover, to, cutover, empty: true } as const;
    }

    if (cutover && from < cutover) {
      from = cutover;
    }

    return { from, to, cutover, empty: false } as const;
  }

  async computeTrialBalance(
    req: Request,
    params: { from: string; to: string },
  ): Promise<TrialBalance> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const norm = await this.normalizeFromToWithCutover({
      tenantId: tenant.id,
      from: this.parseDateOnly(params.from),
      to: this.parseDateOnly(params.to),
    });

    if (norm.empty) {
      return {
        from: params.from,
        to: params.to,
        totals: { totalDebit: 0, totalCredit: 0, net: 0 },
        rows: [],
      };
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: norm.from,
      to: norm.to,
    });

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { gte: norm.from, lte: norm.to },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
      },
    });

    const aById = new Map(accounts.map((a) => [a.id, a] as const));

    const rows: TrialBalanceRow[] = grouped
      .map((g) => {
        const a = aById.get(g.accountId);
        const totalDebit = Number(g._sum.debit ?? 0);
        const totalCredit = Number(g._sum.credit ?? 0);
        return {
          accountId: g.accountId,
          accountCode: a?.code ?? 'UNKNOWN',
          accountName: a?.name ?? 'Unknown account',
          accountType: a?.type ?? 'UNKNOWN',
          totalDebit,
          totalCredit,
          net: this.round2(totalDebit - totalCredit),
        };
      })
      .sort((x, y) => x.accountCode.localeCompare(y.accountCode));

    return {
      from:
        norm.cutover && new Date(params.from) < norm.cutover
          ? norm.cutover.toISOString().slice(0, 10)
          : params.from,
      to: params.to,
      totals: {
        totalDebit: this.round2(rows.reduce((s, r) => s + r.totalDebit, 0)),
        totalCredit: this.round2(rows.reduce((s, r) => s + r.totalCredit, 0)),
        net: this.round2(rows.reduce((s, r) => s + r.net, 0)),
      },
      rows,
    };
  }

  async computeProfitAndLoss(
    req: Request,
    params: { from: string; to: string },
  ): Promise<ProfitLoss> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const key = `reports:pnl:${tenant.id}:${params.from}:${params.to}`;
    return this.cache.getOrSet({
      tenantId: tenant.id,
      key,
      ttlMs: 60_000,
      loader: () => this.computeProfitAndLossUncached(req, params),
    });
  }

  private async computeProfitAndLossUncached(
    req: Request,
    params: { from: string; to: string },
  ): Promise<ProfitLoss> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const norm = await this.normalizeFromToWithCutover({
      tenantId: tenant.id,
      from: this.parseDateOnly(params.from),
      to: this.parseDateOnly(params.to),
    });

    if (norm.empty) {
      return {
        from: params.from,
        to: params.to,
        income: { total: 0, rows: [] },
        expenses: { total: 0, rows: [] },
        profitOrLoss: 0,
      };
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: norm.from,
      to: norm.to,
    });

    const parseCode = (code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? n : null;
    };

    const sectionByCode = (code: string) => {
      const n = parseCode(code);
      if (n === null) return null;
      if (n >= 40000 && n <= 49999) return 'REVENUE' as const;
      if (n >= 50000 && n <= 59999) return 'COST_OF_SALES' as const;
      if (n >= 60000 && n <= 69999) {
        if (n >= 67000 && n <= 67999) return 'TAX_EXPENSE' as const;
        return 'OPERATING_EXPENSES' as const;
      }
      if (n >= 70000 && n <= 79999) return 'OTHER_INCOME' as const;
      if (n >= 80000 && n <= 89999) return 'OTHER_EXPENSES' as const;
      return null;
    };

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { gte: norm.from, lte: norm.to },
        },
        account: {
          tenantId: tenant.id,
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
      },
    });

    const aById = new Map(accounts.map((a) => [a.id, a] as const));

    const incomeRows: ProfitLoss['income']['rows'] = [];
    const expenseRows: ProfitLoss['expenses']['rows'] = [];

    for (const g of grouped) {
      const a = aById.get(g.accountId);
      if (!a) continue;

      const section = sectionByCode(a.code);
      if (!section) {
        // Exclude non-numeric codes and out-of-scope codes (strict IFRS P&L by range).
        continue;
      }

      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      // Sign conventions:
      // - Income-like sections are presented as credit-nature: + (credit - debit)
      // - Expense-like sections are presented as debit-nature: + (debit - credit)
      if (section === 'REVENUE' || section === 'OTHER_INCOME') {
        incomeRows.push({
          accountId: a.id,
          accountCode: a.code,
          accountName: a.name,
          accountType: a.type,
          normalBalance: a.normalBalance ?? undefined,
          reportSection: section,
          balance: this.round2(credit - debit),
        });
        continue;
      }

      expenseRows.push({
        accountId: a.id,
        accountCode: a.code,
        accountName: a.name,
        accountType: a.type,
        normalBalance: a.normalBalance ?? undefined,
        reportSection: section,
        balance: this.round2(debit - credit),
      });
    }

    incomeRows.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
    expenseRows.sort((x, y) => x.accountCode.localeCompare(y.accountCode));

    const totalIncome = this.round2(
      incomeRows.reduce((s, r) => s + r.balance, 0),
    );
    const totalExpenses = this.round2(
      expenseRows.reduce((s, r) => s + r.balance, 0),
    );
    const profitOrLoss = this.round2(totalIncome - totalExpenses);

    return {
      from:
        norm.cutover && new Date(params.from) < norm.cutover
          ? norm.cutover.toISOString().slice(0, 10)
          : params.from,
      to: params.to,
      income: { total: totalIncome, rows: incomeRows },
      expenses: { total: totalExpenses, rows: expenseRows },
      profitOrLoss,
    };
  }

  private async retainedEarnings(params: {
    tenantId: string;
    beforeDate: Date;
  }): Promise<number> {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: { lt: params.beforeDate },
        },
        account: {
          tenantId: params.tenantId,
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: { id: true, type: true },
    });

    const typeById = new Map(accounts.map((a) => [a.id, a.type] as const));

    let totalIncome = 0;
    let totalExpense = 0;

    for (const g of grouped) {
      const t = typeById.get(g.accountId);
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      if (t === 'INCOME') totalIncome += credit - debit;
      if (t === 'EXPENSE') totalExpense += debit - credit;
    }

    return this.round2(totalIncome - totalExpense);
  }

  private classifyShareCapital(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EQUITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('share capital') || n.includes('issued capital');
  }

  private classifyOtherReservesEquityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EQUITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (
      n.includes('share capital') ||
      n.includes('issued capital') ||
      n.includes('retained earnings') ||
      n.includes('retained profit') ||
      n.includes('dividend') ||
      n.includes('drawing')
    ) {
      return false;
    }
    return (
      n.includes('reserve') ||
      n.includes('revaluation') ||
      n.includes('translation') ||
      n.includes('surplus')
    );
  }

  private classifyDividendsOrDrawingsEquityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EQUITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('dividend') || n.includes('drawing') || n.includes('drawings')
    );
  }

  private classifyRetainedEarningsEquityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EQUITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('retained earnings') || n.includes('retained profit');
  }

  private classifyAccumulatedDepreciationAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('accumulated') &&
      (n.includes('depreciation') ||
        n.includes('amortisation') ||
        n.includes('amortization'))
    );
  }

  private classifyIntangibleAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('intangible') || n.includes('goodwill');
  }

  private classifyLongTermInvestmentAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      (n.includes('investment') || n.includes('investments')) &&
      (n.includes('long') ||
        n.includes('non-current') ||
        n.includes('non current'))
    );
  }

  private classifyDeferredTaxAssetAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('deferred tax');
  }

  private classifyAllowanceForDoubtfulDebtsAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      (n.includes('allowance') ||
        n.includes('provision') ||
        n.includes('impair')) &&
      (n.includes('receivable') || n.includes('debt'))
    );
  }

  private classifyArControlOrTradeReceivableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('accounts receivable') ||
      n.includes('trade receivable') ||
      (n.includes('ar') && n.includes('control')) ||
      (n.includes('receivable') && n.includes('control'))
    );
  }

  private classifyVatReceivableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('vat') &&
      (n.includes('receivable') ||
        n.includes('refund') ||
        n.includes('control'))
    );
  }

  private classifyOtherReceivableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (this.classifyArControlOrTradeReceivableAccount(a)) return false;
    if (this.classifyVatReceivableAccount(a)) return false;
    if (this.classifyCashAccount(a)) return false;
    return (
      n.includes('receivable') || n.includes('debt') || n.includes('deposit')
    );
  }

  private classifyApControlOrTradePayableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('accounts payable') ||
      n.includes('trade payable') ||
      (n.includes('ap') && n.includes('control')) ||
      (n.includes('payable') && n.includes('control'))
    );
  }

  private classifyVatPayableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('vat') && (n.includes('payable') || n.includes('control'))
    );
  }

  private classifyAccrualLiabilityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('accrual') || n.includes('accrued');
  }

  private classifyDeferredIncomeLiabilityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('deferred income') ||
      n.includes('deferred revenue') ||
      n.includes('unearned') ||
      n.includes('contract liability')
    );
  }

  private classifyDeferredTaxLiabilityAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('deferred tax');
  }

  private classifyLongTermBorrowingsAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'LIABILITY') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      (n.includes('loan') ||
        n.includes('borrowing') ||
        n.includes('mortgage') ||
        n.includes('note')) &&
      (n.includes('long') ||
        n.includes('non-current') ||
        n.includes('non current'))
    );
  }

  async computeBalanceSheet(
    req: Request,
    params: { asOf: string },
  ): Promise<BalanceSheet> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const key = `reports:bs:${tenant.id}:${params.asOf}`;
    return this.cache.getOrSet({
      tenantId: tenant.id,
      key,
      ttlMs: 60_000,
      loader: () => this.computeBalanceSheetUncached(req, params),
    });
  }

  private async computeBalanceSheetUncached(
    req: Request,
    params: { asOf: string },
  ): Promise<BalanceSheet> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const asOf = this.parseDateOnly(params.asOf);

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    if (cutover && asOf < cutover) {
      throw new BadRequestException({
        error: 'Reporting blocked by cutover lock',
        reason: `Balance sheet asOf before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
      });
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: asOf,
      to: asOf,
    });

    const currentPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: asOf },
        endDate: { gte: asOf },
      },
      select: { startDate: true },
    });

    if (!currentPeriod)
      throw new BadRequestException(
        'No accounting period exists for asOf date',
      );

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { lte: asOf },
        },
        account: {
          tenantId: tenant.id,
          type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
      },
    });

    const aById = new Map(accounts.map((a) => [a.id, a] as const));

    // IAS 1 presentation buckets.
    let ppe = 0;
    let accumulatedDepreciation = 0;
    let intangibles = 0;
    let longTermInvestments = 0;
    let deferredTaxAssets = 0;

    let tradeReceivablesGross = 0;
    let tradeReceivablesAllowance = 0;
    let vatReceivable = 0;
    let otherReceivables = 0;
    let cashAndEquivalents = 0;

    let tradePayables = 0;
    let vatPayable = 0;
    let accruals = 0;
    let deferredIncome = 0;
    let currentOtherLiabilities = 0;
    let bankOverdraft = 0;

    let nonCurrentBorrowings = 0;
    let deferredTaxLiabilities = 0;
    let nonCurrentOtherLiabilities = 0;

    let shareCapital = 0;
    let otherReserves = 0;

    for (const g of grouped) {
      const a = aById.get(g.accountId);
      if (!a) continue;

      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      if (a.type === 'ASSET') {
        const bal = this.round2(debit - credit);

        if (this.classifyCashAccount(a)) {
          cashAndEquivalents = this.round2(cashAndEquivalents + bal);
          continue;
        }
        if (this.classifyAccumulatedDepreciationAccount(a)) {
          accumulatedDepreciation = this.round2(accumulatedDepreciation + bal);
          continue;
        }
        if (this.classifyPpeAccount(a)) {
          ppe = this.round2(ppe + bal);
          continue;
        }
        if (this.classifyIntangibleAccount(a)) {
          intangibles = this.round2(intangibles + bal);
          continue;
        }
        if (this.classifyLongTermInvestmentAccount(a)) {
          longTermInvestments = this.round2(longTermInvestments + bal);
          continue;
        }
        if (this.classifyDeferredTaxAssetAccount(a)) {
          deferredTaxAssets = this.round2(deferredTaxAssets + bal);
          continue;
        }
        if (this.classifyAllowanceForDoubtfulDebtsAccount(a)) {
          tradeReceivablesAllowance = this.round2(
            tradeReceivablesAllowance + bal,
          );
          continue;
        }
        if (this.classifyArControlOrTradeReceivableAccount(a)) {
          tradeReceivablesGross = this.round2(tradeReceivablesGross + bal);
          continue;
        }
        if (this.classifyVatReceivableAccount(a)) {
          vatReceivable = this.round2(vatReceivable + bal);
          continue;
        }
        if (this.classifyOtherReceivableAccount(a)) {
          otherReceivables = this.round2(otherReceivables + bal);
          continue;
        }

        // Everything else defaults to Other receivables under current assets.
        otherReceivables = this.round2(otherReceivables + bal);
        continue;
      }

      if (a.type === 'LIABILITY') {
        const bal = this.round2(credit - debit);

        if (this.classifyLongTermBorrowingsAccount(a)) {
          nonCurrentBorrowings = this.round2(nonCurrentBorrowings + bal);
          continue;
        }
        if (this.classifyDeferredTaxLiabilityAccount(a)) {
          deferredTaxLiabilities = this.round2(deferredTaxLiabilities + bal);
          continue;
        }
        if (this.classifyApControlOrTradePayableAccount(a)) {
          tradePayables = this.round2(tradePayables + bal);
          continue;
        }
        if (this.classifyVatPayableAccount(a)) {
          vatPayable = this.round2(vatPayable + bal);
          continue;
        }
        if (this.classifyAccrualLiabilityAccount(a)) {
          accruals = this.round2(accruals + bal);
          continue;
        }
        if (this.classifyDeferredIncomeLiabilityAccount(a)) {
          deferredIncome = this.round2(deferredIncome + bal);
          continue;
        }

        // Default all others to current liabilities unless clearly non-current.
        const n = `${a.code} ${a.name}`.toLowerCase();
        if (
          n.includes('non-current') ||
          n.includes('non current') ||
          n.includes('long')
        ) {
          nonCurrentOtherLiabilities = this.round2(
            nonCurrentOtherLiabilities + bal,
          );
        } else {
          currentOtherLiabilities = this.round2(currentOtherLiabilities + bal);
        }
        continue;
      }

      if (a.type === 'EQUITY') {
        const bal = this.round2(credit - debit);
        if (this.classifyShareCapital(a)) {
          shareCapital = this.round2(shareCapital + bal);
          continue;
        }
        if (this.classifyOtherReservesEquityAccount(a)) {
          otherReserves = this.round2(otherReserves + bal);
          continue;
        }
        // Ignore all other equity accounts (including retained earnings accounts)
        // and derive a single retained earnings balance below.
        continue;
      }
    }

    const tradeReceivablesNet = this.round2(
      tradeReceivablesGross + tradeReceivablesAllowance,
    );

    // Eliminate negative assets (IAS 1 best practice: do not present negative asset balances).
    // Reclassify negative current assets as current liabilities.
    let tradeReceivablesNetAsset = tradeReceivablesNet;
    if (tradeReceivablesNetAsset < 0) {
      currentOtherLiabilities = this.round2(
        currentOtherLiabilities + Math.abs(tradeReceivablesNetAsset),
      );
      tradeReceivablesNetAsset = 0;
    }

    // Net VAT control accounts to reflect true exposure.
    // Positive => receivable (asset). Negative => payable (liability).
    const vatNet = this.round2(vatReceivable - vatPayable);
    vatReceivable = vatNet > 0 ? vatNet : 0;
    vatPayable = vatNet < 0 ? this.round2(Math.abs(vatNet)) : 0;

    if (otherReceivables < 0) {
      currentOtherLiabilities = this.round2(
        currentOtherLiabilities + Math.abs(otherReceivables),
      );
      otherReceivables = 0;
    }

    if (cashAndEquivalents < 0) {
      bankOverdraft = this.round2(Math.abs(cashAndEquivalents));
      cashAndEquivalents = 0;
    }

    const assets: BalanceSheet['assets']['rows'] = [];
    const liabilities: BalanceSheet['liabilities']['rows'] = [];
    const equity: BalanceSheet['equity']['rows'] = [];

    // Assets: Non-current then Current.
    // Present PPE net (gross and accumulated preserved internally for note disclosures only).
    const ppeNet = this.round2(ppe + accumulatedDepreciation);
    if (ppeNet > 0)
      assets.push({
        accountCode: 'PPE_NET',
        accountName: 'Property, plant and equipment (net)',
        reportSection: 'ASSETS_NON_CURRENT',
        balance: ppeNet,
      });
    if (ppeNet < 0) {
      nonCurrentOtherLiabilities = this.round2(
        nonCurrentOtherLiabilities + Math.abs(ppeNet),
      );
    }
    if (intangibles !== 0)
      if (intangibles > 0) {
        assets.push({
          accountCode: 'INTANGIBLES',
          accountName: 'Intangible assets',
          reportSection: 'ASSETS_NON_CURRENT',
          balance: intangibles,
        });
      } else {
        currentOtherLiabilities = this.round2(
          currentOtherLiabilities + Math.abs(intangibles),
        );
      }
    if (longTermInvestments !== 0)
      if (longTermInvestments > 0) {
        assets.push({
          accountCode: 'LONG_TERM_INVESTMENTS',
          accountName: 'Long-term investments',
          reportSection: 'ASSETS_NON_CURRENT',
          balance: longTermInvestments,
        });
      } else {
        nonCurrentOtherLiabilities = this.round2(
          nonCurrentOtherLiabilities + Math.abs(longTermInvestments),
        );
      }
    if (deferredTaxAssets !== 0)
      if (deferredTaxAssets > 0) {
        assets.push({
          accountCode: 'DEFERRED_TAX_ASSET',
          accountName: 'Deferred tax assets',
          reportSection: 'ASSETS_NON_CURRENT',
          balance: deferredTaxAssets,
        });
      } else {
        nonCurrentOtherLiabilities = this.round2(
          nonCurrentOtherLiabilities + Math.abs(deferredTaxAssets),
        );
      }

    if (tradeReceivablesNetAsset !== 0)
      assets.push({
        accountCode: 'TRADE_RECEIVABLES',
        accountName: 'Trade receivables (net)',
        reportSection: 'ASSETS_CURRENT',
        balance: tradeReceivablesNetAsset,
      });
    if (vatReceivable !== 0)
      assets.push({
        accountCode: 'VAT_RECEIVABLE',
        accountName: 'VAT receivable',
        reportSection: 'ASSETS_CURRENT',
        balance: vatReceivable,
      });
    if (otherReceivables !== 0)
      assets.push({
        accountCode: 'OTHER_RECEIVABLES',
        accountName: 'Other receivables',
        reportSection: 'ASSETS_CURRENT',
        balance: otherReceivables,
      });
    if (cashAndEquivalents !== 0)
      assets.push({
        accountCode: 'CASH_AND_EQUIVALENTS',
        accountName: 'Cash and cash equivalents',
        reportSection: 'ASSETS_CURRENT',
        balance: cashAndEquivalents,
      });

    // Liabilities: Non-current then Current.
    if (nonCurrentBorrowings !== 0)
      liabilities.push({
        accountCode: 'NON_CURRENT_BORROWINGS',
        accountName: 'Non-current borrowings',
        reportSection: 'LIABILITIES_NON_CURRENT',
        balance: nonCurrentBorrowings,
      });
    if (deferredTaxLiabilities !== 0)
      liabilities.push({
        accountCode: 'DEFERRED_TAX_LIABILITY',
        accountName: 'Deferred tax liabilities',
        reportSection: 'LIABILITIES_NON_CURRENT',
        balance: deferredTaxLiabilities,
      });
    if (nonCurrentOtherLiabilities !== 0)
      liabilities.push({
        accountCode: 'NON_CURRENT_LIABILITIES_OTHER',
        accountName: 'Other non-current liabilities',
        reportSection: 'LIABILITIES_NON_CURRENT',
        balance: nonCurrentOtherLiabilities,
      });

    if (tradePayables !== 0)
      liabilities.push({
        accountCode: 'TRADE_PAYABLES',
        accountName: 'Trade payables',
        reportSection: 'LIABILITIES_CURRENT',
        balance: tradePayables,
      });
    if (accruals !== 0)
      liabilities.push({
        accountCode: 'ACCRUALS',
        accountName: 'Accruals',
        reportSection: 'LIABILITIES_CURRENT',
        balance: accruals,
      });
    if (deferredIncome !== 0)
      liabilities.push({
        accountCode: 'DEFERRED_INCOME',
        accountName: 'Deferred income',
        reportSection: 'LIABILITIES_CURRENT',
        balance: deferredIncome,
      });
    if (vatPayable !== 0)
      liabilities.push({
        accountCode: 'VAT_PAYABLE',
        accountName: 'VAT payable',
        reportSection: 'LIABILITIES_CURRENT',
        balance: vatPayable,
      });
    if (bankOverdraft !== 0)
      liabilities.push({
        accountCode: 'BANK_OVERDRAFT',
        accountName: 'Bank overdraft',
        reportSection: 'LIABILITIES_CURRENT',
        balance: bankOverdraft,
      });
    if (currentOtherLiabilities !== 0)
      liabilities.push({
        accountCode: 'CURRENT_LIABILITIES_OTHER',
        accountName: 'Other current liabilities',
        reportSection: 'LIABILITIES_CURRENT',
        balance: currentOtherLiabilities,
      });

    const totalAssets = this.round2(assets.reduce((s, r) => s + r.balance, 0));
    const totalLiabilities = this.round2(
      liabilities.reduce((s, r) => s + r.balance, 0),
    );

    // Equity: enforce structure (always show Share capital, Retained earnings, Other reserves).
    equity.push({
      accountCode: 'SHARE_CAPITAL',
      accountName: 'Share capital',
      reportSection: 'EQUITY',
      balance: shareCapital,
    });

    const retainedEarningsDerived = this.round2(
      totalAssets - totalLiabilities - shareCapital - otherReserves,
    );
    equity.push({
      accountCode: 'RETAINED_EARNINGS',
      accountName: 'Retained earnings (derived)',
      reportSection: 'EQUITY',
      balance: retainedEarningsDerived,
    });

    equity.push({
      accountCode: 'OTHER_RESERVES',
      accountName: 'Other reserves',
      reportSection: 'EQUITY',
      balance: otherReserves,
    });

    const totalEquity = this.round2(equity.reduce((s, r) => s + r.balance, 0));

    return {
      asOf: params.asOf,
      assets: { total: totalAssets, rows: assets },
      liabilities: { total: totalLiabilities, rows: liabilities },
      equity: { total: totalEquity, rows: equity },
      equation: {
        assets: totalAssets,
        liabilitiesPlusEquity: this.round2(totalLiabilities + totalEquity),
        balanced:
          this.round2(totalAssets) ===
          this.round2(totalLiabilities + totalEquity),
      },
    };
  }

  async computeSOCE(
    req: Request,
    params: { from: string; to: string },
  ): Promise<Soce> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const norm = await this.normalizeFromToWithCutover({
      tenantId: tenant.id,
      from: this.parseDateOnly(params.from),
      to: this.parseDateOnly(params.to),
    });

    if (norm.empty) {
      return {
        from: params.from,
        to: params.to,
        shareCapital: {
          opening: 0,
          ownerContributions: 0,
          dividendsOrDrawings: 0,
          profitOrLoss: 0,
          otherMovements: 0,
          movements: 0,
          closing: 0,
        },
        retainedEarnings: {
          opening: 0,
          ownerContributions: 0,
          dividendsOrDrawings: 0,
          profitOrLoss: 0,
          otherMovements: 0,
          movements: 0,
          closing: 0,
        },
        otherReserves: {
          opening: 0,
          ownerContributions: 0,
          dividendsOrDrawings: 0,
          profitOrLoss: 0,
          otherMovements: 0,
          movements: 0,
          closing: 0,
        },
        totalEquity: {
          opening: 0,
          ownerContributions: 0,
          dividendsOrDrawings: 0,
          profitOrLoss: 0,
          otherMovements: 0,
          movements: 0,
          closing: 0,
        },
      };
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: norm.from,
      to: norm.to,
    });

    const from = norm.from;
    const to = norm.to;

    const dayBeforeFrom = this.addUtcDays(this.utcDateOnly(from), -1);

    const bsOpening = await this.computeBalanceSheet(req, {
      asOf: dayBeforeFrom.toISOString().slice(0, 10),
    });

    const openingShareCapital = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'SHARE_CAPITAL')
        ?.balance ?? 0,
    );
    const openingRetainedEarnings = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'RETAINED_EARNINGS')
        ?.balance ?? 0,
    );
    const openingOtherReserves = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'OTHER_RESERVES')
        ?.balance ?? 0,
    );
    const openingEquityTotal = this.round2(
      openingShareCapital + openingRetainedEarnings + openingOtherReserves,
    );

    const pl = await this.computeProfitAndLoss(req, {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    const netProfit = pl.profitOrLoss;

    const groupedEquityMovements = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { gte: from, lte: to },
        },
        account: {
          tenantId: tenant.id,
          type: 'EQUITY',
        },
      },
      _sum: { debit: true, credit: true },
    });

    const equityAccountIds = groupedEquityMovements.map((g) => g.accountId);
    const equityAccounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: equityAccountIds } },
      select: { id: true, code: true, name: true, type: true },
    });
    const equityAccountById = new Map(
      equityAccounts.map((a) => [a.id, a] as const),
    );

    let ownerContributions = 0;
    let dividendsOrDrawings = 0;

    for (const g of groupedEquityMovements) {
      const a = equityAccountById.get(g.accountId);
      if (!a) continue;
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);
      const movement = this.round2(credit - debit);
      if (movement === 0) continue;

      if (this.classifyShareCapital(a)) {
        ownerContributions = this.round2(ownerContributions + movement);
        continue;
      }

      if (this.classifyDividendsOrDrawingsEquityAccount(a)) {
        dividendsOrDrawings = this.round2(dividendsOrDrawings + movement);
        continue;
      }
    }

    const bsClosing = await this.computeBalanceSheet(req, {
      asOf: to.toISOString().slice(0, 10),
    });

    const closingShareCapital = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'SHARE_CAPITAL')
        ?.balance ?? 0,
    );
    const closingRetainedEarnings = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'RETAINED_EARNINGS')
        ?.balance ?? 0,
    );
    const closingOtherReserves = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'OTHER_RESERVES')
        ?.balance ?? 0,
    );
    const closingEquityTotal = this.round2(
      closingShareCapital + closingRetainedEarnings + closingOtherReserves,
    );

    const deltaShareCapital = this.round2(
      closingShareCapital - openingShareCapital,
    );
    const deltaRetainedEarnings = this.round2(
      closingRetainedEarnings - openingRetainedEarnings,
    );
    const deltaOtherReserves = this.round2(
      closingOtherReserves - openingOtherReserves,
    );
    const deltaTotal = this.round2(closingEquityTotal - openingEquityTotal);

    const shareCapitalOtherMovements = this.round2(
      deltaShareCapital - ownerContributions,
    );
    const retainedEarningsOtherMovements = this.round2(
      deltaRetainedEarnings - this.round2(netProfit) - dividendsOrDrawings,
    );
    const otherReservesOtherMovements = this.round2(deltaOtherReserves);
    const totalOtherMovements = this.round2(
      deltaTotal -
        this.round2(netProfit) -
        ownerContributions -
        dividendsOrDrawings,
    );

    const mk = (params: {
      opening: number;
      ownerContributions?: number;
      dividendsOrDrawings?: number;
      profitOrLoss?: number;
      otherMovements: number;
      closing: number;
    }) => {
      const ownerContributions = this.round2(params.ownerContributions ?? 0);
      const dividendsOrDrawings = this.round2(params.dividendsOrDrawings ?? 0);
      const profitOrLoss = this.round2(params.profitOrLoss ?? 0);
      const otherMovements = this.round2(params.otherMovements);
      const movements = this.round2(
        ownerContributions +
          dividendsOrDrawings +
          profitOrLoss +
          otherMovements,
      );
      return {
        opening: this.round2(params.opening),
        ownerContributions,
        dividendsOrDrawings,
        profitOrLoss,
        otherMovements,
        movements,
        closing: this.round2(params.closing),
      };
    };

    return {
      from:
        norm.cutover && new Date(params.from) < norm.cutover
          ? norm.cutover.toISOString().slice(0, 10)
          : params.from,
      to: params.to,
      shareCapital: mk({
        opening: openingShareCapital,
        ownerContributions,
        otherMovements: shareCapitalOtherMovements,
        closing: closingShareCapital,
      }),
      retainedEarnings: mk({
        opening: openingRetainedEarnings,
        dividendsOrDrawings,
        profitOrLoss: this.round2(netProfit),
        otherMovements: retainedEarningsOtherMovements,
        closing: closingRetainedEarnings,
      }),
      otherReserves: mk({
        opening: openingOtherReserves,
        otherMovements: otherReservesOtherMovements,
        closing: closingOtherReserves,
      }),
      totalEquity: mk({
        opening: openingEquityTotal,
        ownerContributions,
        dividendsOrDrawings,
        profitOrLoss: this.round2(netProfit),
        otherMovements: totalOtherMovements,
        closing: closingEquityTotal,
      }),
    };
  }

  private classifyCashAccount(a: { code: string; name: string; type: string }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'ASSET') return false;
    return n.includes('cash') || n.includes('bank') || a.code === '1000';
  }

  private classifyDepreciationExpense(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EXPENSE') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('depreciation') || n.includes('amort') || n.includes('depr')
    );
  }

  private classifyWorkingCapital(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();

    if (
      a.type === 'ASSET' &&
      (n.includes('accounts receivable') ||
        n.includes('receivable') ||
        a.code === '1100')
    ) {
      return { bucket: 'AR' as const, label: 'Change in Accounts Receivable' };
    }

    if (
      a.type === 'LIABILITY' &&
      (n.includes('accounts payable') ||
        n.includes('payable') ||
        a.code === '2000')
    ) {
      return { bucket: 'AP' as const, label: 'Change in Accounts Payable' };
    }

    if (a.type === 'ASSET' && n.includes('inventory')) {
      return { bucket: 'INV' as const, label: 'Change in Inventory' };
    }

    if (
      a.type === 'ASSET' &&
      (n.includes('prepayment') ||
        n.includes('prepaid') ||
        n.includes('advance'))
    ) {
      return { bucket: 'PREP' as const, label: 'Change in Prepayments' };
    }

    if (
      a.type === 'LIABILITY' &&
      (n.includes('accrual') || n.includes('accrued'))
    ) {
      return { bucket: 'ACCR' as const, label: 'Change in Accruals' };
    }

    if (
      a.type === 'LIABILITY' &&
      (n.includes('deferred income') ||
        n.includes('deferred revenue') ||
        n.includes('unearned') ||
        n.includes('contract liability'))
    ) {
      return { bucket: 'DEF' as const, label: 'Change in Deferred income' };
    }

    return null;
  }

  private classifyInterestIncome(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'INCOME') return false;
    return (
      n.includes('interest') &&
      (n.includes('income') || n.includes('received') || n.includes('earned'))
    );
  }

  private classifyInterestExpense(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'EXPENSE') return false;
    return n.includes('interest');
  }

  private classifyImpairmentOrBadDebtsExpense(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'EXPENSE') return false;
    return (
      n.includes('impair') ||
      n.includes('bad debt') ||
      n.includes('bad debts') ||
      n.includes('doubtful')
    );
  }

  private classifyPpeAccount(a: { code: string; name: string; type: string }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'ASSET') return false;
    return (
      n.includes('property') ||
      n.includes('plant') ||
      n.includes('equipment') ||
      n.includes('ppe') ||
      n.includes('fixed asset')
    );
  }

  private classifyBorrowingsAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'LIABILITY') return false;
    return (
      n.includes('loan') ||
      n.includes('borrow') ||
      n.includes('overdraft') ||
      n.includes('note payable') ||
      n.includes('notes payable')
    );
  }

  private classifyDividendsAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    return n.includes('dividend');
  }

  private async balanceByAccountAsOf(params: { tenantId: string; asOf: Date }) {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: { lte: params.asOf },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: { id: true, code: true, name: true, type: true },
    });

    const aById = new Map(accounts.map((a) => [a.id, a] as const));

    const balanceById = new Map<
      string,
      {
        accountId: string;
        code: string;
        name: string;
        type: string;
        // debit - credit net
        net: number;
        debit: number;
        credit: number;
      }
    >();

    for (const g of grouped) {
      const a = aById.get(g.accountId);
      if (!a) continue;
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);
      balanceById.set(g.accountId, {
        accountId: g.accountId,
        code: a.code,
        name: a.name,
        type: a.type,
        debit,
        credit,
        net: this.round2(debit - credit),
      });
    }

    return balanceById;
  }

  async computeCashFlowIndirect(
    req: Request,
    params: { from: string; to: string },
  ): Promise<CashFlowIndirect> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const norm = await this.normalizeFromToWithCutover({
      tenantId: tenant.id,
      from: this.parseDateOnly(params.from),
      to: this.parseDateOnly(params.to),
    });

    if (norm.empty) {
      return {
        from: params.from,
        to: params.to,
        operating: {
          profitBeforeTax: 0,
          adjustments: [],
          workingCapital: [],
          netCashFromOperating: 0,
        },
        investing: { rows: [], netCashFromInvesting: 0 },
        financing: { rows: [], netCashFromFinancing: 0 },
        cash: { openingCash: 0, closingCash: 0, netChangeInCash: 0 },
      };
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: norm.from,
      to: norm.to,
    });

    const pl = await this.computeProfitAndLoss(req, {
      from: norm.from.toISOString().slice(0, 10),
      to: norm.to.toISOString().slice(0, 10),
    });

    const taxExpense = this.round2(
      pl.expenses.rows
        .filter((x) => x.reportSection === 'TAX_EXPENSE')
        .reduce((s, r) => s + r.balance, 0),
    );
    const profitBeforeTax = this.round2(pl.profitOrLoss + taxExpense);

    const openingAsOf = this.addUtcDays(this.utcDateOnly(norm.from), -1);
    const closingAsOf = this.utcDateOnly(norm.to);

    const [openingBalances, closingBalances] = await Promise.all([
      this.balanceByAccountAsOf({ tenantId: tenant.id, asOf: openingAsOf }),
      this.balanceByAccountAsOf({ tenantId: tenant.id, asOf: closingAsOf }),
    ]);

    const allAccountIds = new Set([
      ...openingBalances.keys(),
      ...closingBalances.keys(),
    ]);

    const wcByBucket = new Map<string, { label: string; amount: number }>();

    let openingCash = 0;
    let closingCash = 0;

    for (const id of allAccountIds) {
      const o = openingBalances.get(id);
      const c = closingBalances.get(id);
      const acc = c ?? o;
      if (!acc) continue;

      const openingNet = o?.net ?? 0;
      const closingNet = c?.net ?? 0;
      const openingBalance =
        acc.type === 'LIABILITY' ? -openingNet : openingNet;
      const closingBalance =
        acc.type === 'LIABILITY' ? -closingNet : closingNet;
      const delta = this.round2(closingBalance - openingBalance);

      const wc = this.classifyWorkingCapital(acc);
      if (wc) {
        // IAS 7 cash direction:
        // - Increase in current assets => cash out (negative)
        // - Increase in current liabilities => cash in (positive)
        const cashEffect = this.round2((acc.type === 'ASSET' ? -1 : 1) * delta);
        const prev = wcByBucket.get(wc.bucket)?.amount ?? 0;
        wcByBucket.set(wc.bucket, {
          label: wc.label,
          amount: this.round2(prev + cashEffect),
        });
      }

      if (this.classifyCashAccount(acc)) {
        openingCash = this.round2(openingCash + openingNet);
        closingCash = this.round2(closingCash + closingNet);
      }
    }

    // IAS 7 adjustments derived from authoritative P&L rows (not recomputed from journals).
    const depreciationFromPl = this.round2(
      pl.expenses.rows
        .filter((x) =>
          this.classifyDepreciationExpense({
            code: x.accountCode,
            name: x.accountName,
            type: 'EXPENSE',
          }),
        )
        .reduce((s, r) => s + r.balance, 0),
    );
    const impairmentFromPl = this.round2(
      pl.expenses.rows
        .filter((x) =>
          this.classifyImpairmentOrBadDebtsExpense({
            code: x.accountCode,
            name: x.accountName,
            type: 'EXPENSE',
          }),
        )
        .reduce((s, r) => s + r.balance, 0),
    );
    const interestExpenseFromPl = this.round2(
      pl.expenses.rows
        .filter((x) =>
          this.classifyInterestExpense({
            code: x.accountCode,
            name: x.accountName,
            type: 'EXPENSE',
          }),
        )
        .reduce((s, r) => s + r.balance, 0),
    );

    const adjustments: Array<{ label: string; amount: number }> = [];
    // Add back non-cash items.
    if (depreciationFromPl !== 0) {
      adjustments.push({
        label: 'Depreciation / amortisation',
        amount: this.round2(depreciationFromPl),
      });
    }
    if (impairmentFromPl !== 0) {
      adjustments.push({
        label: 'Impairments / bad debts',
        amount: this.round2(impairmentFromPl),
      });
    }

    // Remove/restore financing and investing items included in P&L.
    if (interestExpenseFromPl !== 0) {
      adjustments.push({
        label: 'Interest expense',
        amount: this.round2(interestExpenseFromPl),
      });
    }

    const workingCapital = [...wcByBucket.values()].filter(
      (x) => x.amount !== 0,
    );

    const profitBeforeTaxRow = this.round2(profitBeforeTax);
    const adjustmentsTotal = this.round2(
      adjustments.reduce((s, a) => s + a.amount, 0),
    );
    const workingCapitalTotal = this.round2(
      workingCapital.reduce((s, a) => s + a.amount, 0),
    );
    const netCashFromOperating = this.round2(
      profitBeforeTaxRow + adjustmentsTotal + workingCapitalTotal,
    );

    // Investing / financing cash flows derived from cash/bank journal entries.
    // Note: this is intentionally conservative; only entries with a clear counterparty category are classified.
    const periodFrom = norm.from;
    const periodTo = norm.to;

    const cashAccounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, code: true, name: true, type: true },
    });
    const cashAccountIds = new Set(
      cashAccounts.filter((a) => this.classifyCashAccount(a)).map((a) => a.id),
    );
    const cashLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { gte: periodFrom, lte: periodTo },
        },
        accountId: { in: [...cashAccountIds] },
      },
      select: {
        id: true,
        journalEntryId: true,
        accountId: true,
        debit: true,
        credit: true,
      },
    });

    const entryIds = [...new Set(cashLines.map((l) => l.journalEntryId))];
    const entryOtherLines = await this.prisma.journalLine.findMany({
      where: {
        journalEntryId: { in: entryIds },
      },
      select: {
        journalEntryId: true,
        accountId: true,
        debit: true,
        credit: true,
        account: { select: { code: true, name: true, type: true } },
      },
    });

    const othersByEntry = new Map<
      string,
      Array<{
        accountId: string;
        debit: number;
        credit: number;
        account: { code: string; name: string; type: string };
      }>
    >();
    for (const l of entryOtherLines) {
      const arr = othersByEntry.get(l.journalEntryId) ?? [];
      arr.push({
        accountId: l.accountId,
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        account: l.account,
      });
      othersByEntry.set(l.journalEntryId, arr);
    }

    let ppePurchase = 0;
    let ppeProceeds = 0;
    let borrowingsProceeds = 0;
    let borrowingsRepayment = 0;
    let dividendsPaid = 0;

    for (const cl of cashLines) {
      const cashEffect = this.round2(
        Number(cl.debit ?? 0) - Number(cl.credit ?? 0),
      );
      if (cashEffect === 0) continue;

      const otherLines = (othersByEntry.get(cl.journalEntryId) ?? []).filter(
        (x) => !cashAccountIds.has(x.accountId),
      );
      if (otherLines.length === 0) continue;

      // Classify if all non-cash lines belong to one category.
      const hasPpe = otherLines.some((x) => this.classifyPpeAccount(x.account));
      const hasBorrow = otherLines.some((x) =>
        this.classifyBorrowingsAccount(x.account),
      );
      const hasDiv = otherLines.some((x) =>
        this.classifyDividendsAccount(x.account),
      );

      const categories = [hasPpe, hasBorrow, hasDiv].filter(Boolean).length;
      if (categories !== 1) continue;

      if (hasPpe) {
        if (cashEffect < 0) ppePurchase = this.round2(ppePurchase + cashEffect);
        else ppeProceeds = this.round2(ppeProceeds + cashEffect);
      }
      if (hasBorrow) {
        if (cashEffect > 0)
          borrowingsProceeds = this.round2(borrowingsProceeds + cashEffect);
        else
          borrowingsRepayment = this.round2(borrowingsRepayment + cashEffect);
      }
      if (hasDiv) {
        dividendsPaid = this.round2(dividendsPaid + cashEffect);
      }
    }

    const investingRows: Array<{ label: string; amount: number }> = [];
    if (ppePurchase !== 0)
      investingRows.push({
        label: 'Purchase of property, plant and equipment',
        amount: this.round2(ppePurchase),
      });
    if (ppeProceeds !== 0)
      investingRows.push({
        label: 'Proceeds from sale of property, plant and equipment',
        amount: this.round2(ppeProceeds),
      });

    const financingRows: Array<{ label: string; amount: number }> = [];
    if (borrowingsProceeds !== 0)
      financingRows.push({
        label: 'Proceeds from borrowings',
        amount: this.round2(borrowingsProceeds),
      });
    if (borrowingsRepayment !== 0)
      financingRows.push({
        label: 'Repayment of borrowings',
        amount: this.round2(borrowingsRepayment),
      });
    if (dividendsPaid !== 0)
      financingRows.push({
        label: 'Dividends paid',
        amount: this.round2(dividendsPaid),
      });

    const netCashFromInvesting = this.round2(
      investingRows.reduce((s, r) => s + r.amount, 0),
    );
    const netCashFromFinancing = this.round2(
      financingRows.reduce((s, r) => s + r.amount, 0),
    );

    const netChangeInCash = this.round2(closingCash - openingCash);

    const unclassifiedCashMovements = this.round2(
      netChangeInCash -
        (netCashFromOperating + netCashFromInvesting + netCashFromFinancing),
    );

    if (unclassifiedCashMovements !== 0) {
      adjustments.push({
        label: 'Unclassified cash movements',
        amount: unclassifiedCashMovements,
      });
    }

    const adjustedAdjustmentsTotal = this.round2(
      adjustments.reduce((s, a) => s + a.amount, 0),
    );
    const adjustedNetCashFromOperating = this.round2(
      profitBeforeTaxRow + adjustedAdjustmentsTotal + workingCapitalTotal,
    );

    return {
      from:
        norm.cutover && new Date(params.from) < norm.cutover
          ? norm.cutover.toISOString().slice(0, 10)
          : params.from,
      to: params.to,
      operating: {
        profitBeforeTax: this.round2(profitBeforeTax),
        adjustments,
        workingCapital,
        netCashFromOperating: adjustedNetCashFromOperating,
      },
      investing: {
        rows: investingRows,
        netCashFromInvesting,
      },
      financing: {
        rows: financingRows,
        netCashFromFinancing,
      },
      cash: {
        openingCash,
        closingCash,
        netChangeInCash,
      },
    };
  }
}
