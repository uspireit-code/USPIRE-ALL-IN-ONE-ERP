import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { FinancialStatementsService } from './financial-statements.service';

export type PresentedAmount = {
  value: number;
  display: string;
};

export type PresentedRow = {
  key: string;
  label: string;
  amount: PresentedAmount;
  compareAmount?: PresentedAmount;
};

export type PresentedSection = {
  key: string;
  label: string;
  rows: PresentedRow[];
  subtotal?: PresentedRow;
};

export type PresentedReport = {
  reportType: 'PL' | 'BS' | 'SOCE' | 'CF';
  title: string;
  period: {
    from?: string;
    to?: string;
    asOf?: string;
    fiscalYear?: number;
  };
  comparePeriod?: {
    from?: string;
    to?: string;
    asOf?: string;
    fiscalYear?: number;
  };
  sections: PresentedSection[];
  totals: PresentedRow[];
  compareOmittedReason?: string;
};

function money(n: number) {
  return Number(n).toFixed(2);
}

@Injectable()
export class ReportPresentationService {
  constructor(private readonly engine: FinancialStatementsService) {}

  private present(n: number): PresentedAmount {
    return {
      value: n,
      display: n < 0 ? `(${money(Math.abs(n))})` : money(n),
    };
  }

  private addMonths(isoDate: string, monthsDelta: number) {
    const d = new Date(isoDate);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const out = new Date(Date.UTC(y, m + monthsDelta, day));
    return out.toISOString().slice(0, 10);
  }

  async presentPL(
    req: Request,
    params: {
      from: string;
      to: string;
      compare?: 'prior_month' | 'prior_year';
    },
  ) {
    const current = await this.engine.computeProfitAndLoss(req, {
      from: params.from,
      to: params.to,
    });

    let compare: null | Awaited<
      ReturnType<FinancialStatementsService['computeProfitAndLoss']>
    > = null;
    let comparePeriod: PresentedReport['comparePeriod'] | undefined;
    let compareOmittedReason: string | undefined;

    if (params.compare) {
      const cFrom = this.addMonths(
        params.from,
        params.compare === 'prior_month' ? -1 : -12,
      );
      const cTo = this.addMonths(
        params.to,
        params.compare === 'prior_month' ? -1 : -12,
      );
      try {
        compare = await this.engine.computeProfitAndLoss(req, {
          from: cFrom,
          to: cTo,
        });
        comparePeriod = { from: compare.from, to: compare.to };
      } catch (e: any) {
        compareOmittedReason =
          e?.message ?? 'Comparison omitted due to controls';
      }
    }

    const compareBalanceFor = (params: {
      prefix: 'INC' | 'EXP';
      accountCode: string;
      accountName: string;
    }) => {
      if (!compare) return undefined;
      const rows =
        params.prefix === 'INC' ? compare.income.rows : compare.expenses.rows;
      return (
        rows.find(
          (x) =>
            x.accountCode === params.accountCode &&
            x.accountName === params.accountName,
        )?.balance ?? 0
      );
    };

    const parseCode = (code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? n : null;
    };

    const categorize = (
      row:
        | (typeof current.income.rows)[number]
        | (typeof current.expenses.rows)[number],
      source: 'INC' | 'EXP',
    ) => {
      const n = parseCode(row.accountCode);
      if (n !== null) {
        if (n >= 40000 && n <= 49999) return 'REVENUE';
        if (n >= 50000 && n <= 59999) return 'COST_OF_SALES';
        if (n >= 60000 && n <= 69999) return 'OPERATING_EXPENSES';
        if (n >= 70000 && n <= 79999) return 'OTHER_INCOME';
        if (n >= 80000 && n <= 89999) return 'OTHER_EXPENSES';
        if (n >= 67000 && n <= 67999) return 'TAX_EXPENSE';
      }
      return source === 'INC' ? 'OTHER_INCOME' : 'OPERATING_EXPENSES';
    };

    const asPresentedRows = (
      keyPrefix: 'INC' | 'EXP',
      rows: Array<{
        accountCode: string;
        accountName: string;
        balance: number;
      }>,
      normal: 'DR' | 'CR',
    ) =>
      rows.map((r) => {
        const key = `${keyPrefix}:${r.accountCode}`;
        const c = compareBalanceFor({
          prefix: keyPrefix,
          accountCode: r.accountCode,
          accountName: r.accountName,
        });
        return {
          key,
          label: `${r.accountCode} ${r.accountName}`,
          amount: this.present(r.balance),
          compareAmount: compare ? this.present(c ?? 0) : undefined,
        };
      });

    const income = [...current.income.rows].map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      balance: r.balance,
      category: categorize(r, 'INC'),
    }));

    const expenses = [...current.expenses.rows].map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      balance: r.balance,
      category: categorize(r, 'EXP'),
    }));

    const revenue = income
      .filter((r) => r.category === 'REVENUE')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const costOfSales = expenses
      .filter((r) => r.category === 'COST_OF_SALES')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const operatingExpenses = expenses
      .filter((r) => r.category === 'OPERATING_EXPENSES')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const otherIncome = income
      .filter((r) => r.category === 'OTHER_INCOME')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const otherExpenses = expenses
      .filter((r) => r.category === 'OTHER_EXPENSES')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const taxExpense = expenses
      .filter((r) => r.category === 'TAX_EXPENSE')
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const sum = (rows: Array<{ balance: number }>) =>
      rows.reduce((s, r) => s + r.balance, 0);

    const revenueTotal = revenue.length ? sum(revenue) : 0;
    const costOfSalesTotal = costOfSales.length ? sum(costOfSales) : 0;
    const operatingExpensesTotal = operatingExpenses.length
      ? sum(operatingExpenses)
      : 0;
    const otherIncomeTotal = otherIncome.length ? sum(otherIncome) : 0;
    const otherExpensesTotal = otherExpenses.length ? sum(otherExpenses) : 0;
    const taxExpenseTotal = taxExpense.length ? sum(taxExpense) : 0;

    const grossProfit = revenueTotal - costOfSalesTotal;
    const operatingProfit = grossProfit - operatingExpensesTotal;
    const profitBeforeTax =
      operatingProfit + otherIncomeTotal - otherExpensesTotal;
    const profitForPeriod = profitBeforeTax - taxExpenseTotal;

    const compareTotals = compare
      ? (() => {
          const cIncome = compare.income.rows.map((r) => ({
            accountCode: r.accountCode,
            accountName: r.accountName,
            balance: r.balance,
            category: categorize(r as any, 'INC'),
          }));
          const cExpenses = compare.expenses.rows.map((r) => ({
            accountCode: r.accountCode,
            accountName: r.accountName,
            balance: r.balance,
            category: categorize(r as any, 'EXP'),
          }));
          const cRevenue = cIncome.filter((r) => r.category === 'REVENUE');
          const cCostOfSales = cExpenses.filter(
            (r) => r.category === 'COST_OF_SALES',
          );
          const cOpEx = cExpenses.filter(
            (r) => r.category === 'OPERATING_EXPENSES',
          );
          const cOtherInc = cIncome.filter(
            (r) => r.category === 'OTHER_INCOME',
          );
          const cOtherExp = cExpenses.filter(
            (r) => r.category === 'OTHER_EXPENSES',
          );
          const cTax = cExpenses.filter((r) => r.category === 'TAX_EXPENSE');
          const cRevenueTotal = cRevenue.length ? sum(cRevenue) : 0;
          const cCostTotal = cCostOfSales.length ? sum(cCostOfSales) : 0;
          const cOpExTotal = cOpEx.length ? sum(cOpEx) : 0;
          const cOtherIncTotal = cOtherInc.length ? sum(cOtherInc) : 0;
          const cOtherExpTotal = cOtherExp.length ? sum(cOtherExp) : 0;
          const cTaxTotal = cTax.length ? sum(cTax) : 0;
          const cGross = cRevenueTotal - cCostTotal;
          const cOpProfit = cGross - cOpExTotal;
          const cPbt = cOpProfit + cOtherIncTotal - cOtherExpTotal;
          const cProfit = cPbt - cTaxTotal;
          return {
            revenueTotal: cRevenueTotal,
            costOfSalesTotal: cCostTotal,
            grossProfit: cGross,
            operatingExpensesTotal: cOpExTotal,
            operatingProfit: cOpProfit,
            otherIncomeTotal: cOtherIncTotal,
            otherExpensesTotal: cOtherExpTotal,
            profitBeforeTax: cPbt,
            taxExpenseTotal: cTaxTotal,
            profitForPeriod: cProfit,
          };
        })()
      : null;

    return {
      reportType: 'PL' as const,
      title: 'Profit & Loss',
      period: { from: current.from, to: current.to },
      comparePeriod,
      compareOmittedReason,
      sections: [
        {
          key: 'revenue',
          label: 'Revenue',
          rows: asPresentedRows('INC', revenue, 'CR'),
          subtotal: {
            key: 'revenue_total',
            label: 'Total Revenue',
            amount: this.present(revenueTotal),
            compareAmount: compare
              ? this.present(compareTotals?.revenueTotal ?? 0)
              : undefined,
          },
        },
        {
          key: 'cost_of_sales',
          label: 'Cost of Sales',
          rows: asPresentedRows('EXP', costOfSales, 'DR'),
          subtotal: {
            key: 'cost_of_sales_total',
            label: 'Total Cost of Sales',
            amount: this.present(costOfSalesTotal),
            compareAmount: compare
              ? this.present(compareTotals?.costOfSalesTotal ?? 0)
              : undefined,
          },
        },
        {
          key: 'gross_profit',
          label: 'Gross Profit',
          rows: [],
          subtotal: {
            key: 'gross_profit_total',
            label: 'Gross Profit',
            amount: this.present(grossProfit),
            compareAmount: compare
              ? this.present(compareTotals?.grossProfit ?? 0)
              : undefined,
          },
        },
        {
          key: 'operating_expenses',
          label: 'Operating Expenses',
          rows: asPresentedRows('EXP', operatingExpenses, 'DR'),
          subtotal: {
            key: 'operating_expenses_total',
            label: 'Total Operating Expenses',
            amount: this.present(operatingExpensesTotal),
            compareAmount: compare
              ? this.present(compareTotals?.operatingExpensesTotal ?? 0)
              : undefined,
          },
        },
        {
          key: 'operating_profit',
          label: 'Operating Profit',
          rows: [],
          subtotal: {
            key: 'operating_profit_total',
            label: 'Operating Profit',
            amount: this.present(operatingProfit),
            compareAmount: compare
              ? this.present(compareTotals?.operatingProfit ?? 0)
              : undefined,
          },
        },
        {
          key: 'other_income',
          label: 'Other Income',
          rows: asPresentedRows('INC', otherIncome, 'CR'),
          subtotal: {
            key: 'other_income_total',
            label: 'Total Other Income',
            amount: this.present(otherIncomeTotal),
            compareAmount: compare
              ? this.present(compareTotals?.otherIncomeTotal ?? 0)
              : undefined,
          },
        },
        {
          key: 'other_expenses',
          label: 'Other Expenses',
          rows: asPresentedRows('EXP', otherExpenses, 'DR'),
          subtotal: {
            key: 'other_expenses_total',
            label: 'Total Other Expenses',
            amount: this.present(otherExpensesTotal),
            compareAmount: compare
              ? this.present(compareTotals?.otherExpensesTotal ?? 0)
              : undefined,
          },
        },
        {
          key: 'profit_before_tax',
          label: 'Profit Before Tax',
          rows: [],
          subtotal: {
            key: 'profit_before_tax_total',
            label: 'Profit Before Tax',
            amount: this.present(profitBeforeTax),
            compareAmount: compare
              ? this.present(compareTotals?.profitBeforeTax ?? 0)
              : undefined,
          },
        },
        ...(taxExpenseTotal
          ? [
              {
                key: 'tax_expense',
                label: 'Tax Expense',
                rows: asPresentedRows('EXP', taxExpense, 'DR'),
                subtotal: {
                  key: 'tax_expense_total',
                  label: 'Total Tax Expense',
                  amount: this.present(taxExpenseTotal),
                  compareAmount: compare
                    ? this.present(compareTotals?.taxExpenseTotal ?? 0)
                    : undefined,
                },
              },
            ]
          : []),
      ],
      totals: [
        {
          key: 'profit_for_period',
          label: 'Profit for the Period',
          amount: this.present(profitForPeriod),
          compareAmount: compare
            ? this.present(compareTotals?.profitForPeriod ?? 0)
            : undefined,
        },
      ],
    } satisfies PresentedReport;
  }

  async presentBS(
    req: Request,
    params: { asOf: string; compare?: 'prior_month' | 'prior_year' },
  ) {
    const current = await this.engine.computeBalanceSheet(req, {
      asOf: params.asOf,
    });

    let compare: null | Awaited<
      ReturnType<FinancialStatementsService['computeBalanceSheet']>
    > = null;
    let comparePeriod: PresentedReport['comparePeriod'] | undefined;
    let compareOmittedReason: string | undefined;

    if (params.compare) {
      const cAsOf = this.addMonths(
        params.asOf,
        params.compare === 'prior_month' ? -1 : -12,
      );
      try {
        compare = await this.engine.computeBalanceSheet(req, { asOf: cAsOf });
        comparePeriod = { asOf: compare.asOf };
      } catch (e: any) {
        compareOmittedReason =
          e?.message ?? 'Comparison omitted due to controls';
      }
    }

    const section = (
      key: string,
      label: string,
      rows: Array<{
        accountCode: string;
        accountName: string;
        balance: number;
      }>,
      subtotalLabel: string,
      compareRows?: Array<{
        accountCode: string;
        accountName: string;
        balance: number;
      }>,
      compareSubtotal?: number,
    ): PresentedSection => ({
      key,
      label,
      rows: rows.map((r) => ({
        key: `${key}:${r.accountCode}`,
        label: `${r.accountCode} ${r.accountName}`,
        amount: this.present(r.balance),
        compareAmount: compare
          ? this.present(
              compareRows?.find((x) => x.accountCode === r.accountCode)
                ?.balance ?? 0,
            )
          : undefined,
      })),
      subtotal: {
        key: `${key}_total`,
        label: subtotalLabel,
        amount: this.present(rows.reduce((s, r) => s + r.balance, 0)),
        compareAmount: compare ? this.present(compareSubtotal ?? 0) : undefined,
      },
    });

    const curAssetsNonCurrent = current.assets.rows.filter(
      (r: any) => r.reportSection === 'ASSETS_NON_CURRENT',
    );
    const curAssetsCurrent = current.assets.rows.filter(
      (r: any) => r.reportSection === 'ASSETS_CURRENT',
    );
    const curLiabNonCurrent = current.liabilities.rows.filter(
      (r: any) => r.reportSection === 'LIABILITIES_NON_CURRENT',
    );
    const curLiabCurrent = current.liabilities.rows.filter(
      (r: any) => r.reportSection === 'LIABILITIES_CURRENT',
    );

    const cmpAssetsNonCurrent = compare
      ? compare.assets.rows.filter(
          (r: any) => r.reportSection === 'ASSETS_NON_CURRENT',
        )
      : undefined;
    const cmpAssetsCurrent = compare
      ? compare.assets.rows.filter(
          (r: any) => r.reportSection === 'ASSETS_CURRENT',
        )
      : undefined;
    const cmpLiabNonCurrent = compare
      ? compare.liabilities.rows.filter(
          (r: any) => r.reportSection === 'LIABILITIES_NON_CURRENT',
        )
      : undefined;
    const cmpLiabCurrent = compare
      ? compare.liabilities.rows.filter(
          (r: any) => r.reportSection === 'LIABILITIES_CURRENT',
        )
      : undefined;

    return {
      reportType: 'BS' as const,
      title: 'Balance Sheet',
      period: { asOf: current.asOf },
      comparePeriod,
      compareOmittedReason,
      sections: [
        section(
          'assets_non_current',
          'Non-current assets',
          curAssetsNonCurrent,
          'Total non-current assets',
          cmpAssetsNonCurrent,
          compare
            ? (cmpAssetsNonCurrent?.reduce((s, r) => s + r.balance, 0) ?? 0)
            : undefined,
        ),
        section(
          'assets_current',
          'Current assets',
          curAssetsCurrent,
          'Total current assets',
          cmpAssetsCurrent,
          compare
            ? (cmpAssetsCurrent?.reduce((s, r) => s + r.balance, 0) ?? 0)
            : undefined,
        ),
        {
          key: 'assets_total',
          label: 'Assets',
          rows: [],
          subtotal: {
            key: 'assets_total_total',
            label: 'Total assets',
            amount: this.present(current.assets.total),
            compareAmount: compare
              ? this.present(compare.assets.total)
              : undefined,
          },
        },
        section(
          'equity',
          'Equity',
          current.equity.rows,
          'Total equity',
          compare ? compare.equity.rows : undefined,
          compare ? compare.equity.total : undefined,
        ),
        section(
          'liabilities_non_current',
          'Non-current liabilities',
          curLiabNonCurrent,
          'Total non-current liabilities',
          cmpLiabNonCurrent,
          compare
            ? (cmpLiabNonCurrent?.reduce((s, r) => s + r.balance, 0) ?? 0)
            : undefined,
        ),
        section(
          'liabilities_current',
          'Current liabilities',
          curLiabCurrent,
          'Total current liabilities',
          cmpLiabCurrent,
          compare
            ? (cmpLiabCurrent?.reduce((s, r) => s + r.balance, 0) ?? 0)
            : undefined,
        ),
        {
          key: 'liabilities_total',
          label: 'Liabilities',
          rows: [],
          subtotal: {
            key: 'liabilities_total_total',
            label: 'Total liabilities',
            amount: this.present(current.liabilities.total),
            compareAmount: compare
              ? this.present(compare.liabilities.total)
              : undefined,
          },
        },
      ],
      totals: [
        {
          key: 'equation_assets',
          label: 'Assets',
          amount: this.present(current.equation.assets),
          compareAmount: compare
            ? this.present(compare.equation.assets)
            : undefined,
        },
        {
          key: 'equation_lpe',
          label: 'Liabilities + Equity',
          amount: this.present(current.equation.liabilitiesPlusEquity),
          compareAmount: compare
            ? this.present(compare.equation.liabilitiesPlusEquity)
            : undefined,
        },
      ],
    } satisfies PresentedReport;
  }

  async presentSOCE(
    req: Request,
    params: { fiscalYear: number; compare?: 'prior_year' },
  ) {
    const current = await this.engine.computeSOCE(req, {
      fiscalYear: params.fiscalYear,
    });

    let compare: null | Awaited<
      ReturnType<FinancialStatementsService['computeSOCE']>
    > = null;
    let comparePeriod: PresentedReport['comparePeriod'] | undefined;
    let compareOmittedReason: string | undefined;

    if (params.compare) {
      const cYear = params.fiscalYear - 1;
      try {
        compare = await this.engine.computeSOCE(req, { fiscalYear: cYear });
        comparePeriod = {
          fiscalYear: cYear,
          from: compare.from,
          to: compare.to,
        };
      } catch (e: any) {
        compareOmittedReason =
          e?.message ?? 'Comparison omitted due to controls';
      }
    }

    const rows: PresentedRow[] = [
      {
        key: 'opening_equity',
        label: 'Opening equity',
        amount: this.present(current.totalEquity.opening),
        compareAmount: compare
          ? this.present(compare.totalEquity.opening)
          : undefined,
      },
      {
        key: 'net_profit',
        label: 'Profit for the period',
        amount: this.present(current.totalEquity.profitOrLoss),
        compareAmount: compare
          ? this.present(compare.totalEquity.profitOrLoss)
          : undefined,
      },
      {
        key: 'other_movements',
        label: 'Other equity movements',
        amount: this.present(current.totalEquity.otherMovements),
        compareAmount: compare
          ? this.present(compare.totalEquity.otherMovements)
          : undefined,
      },
    ];

    return {
      reportType: 'SOCE' as const,
      title: 'Statement of Changes in Equity',
      period: {
        fiscalYear: current.fiscalYear,
        from: current.from,
        to: current.to,
      },
      comparePeriod,
      compareOmittedReason,
      sections: [
        {
          key: 'soce',
          label: 'Equity movement',
          rows,
          subtotal: {
            key: 'closing_equity',
            label: 'Closing equity',
            amount: this.present(current.totalEquity.closing),
            compareAmount: compare
              ? this.present(compare.totalEquity.closing)
              : undefined,
          },
        },
      ],
      totals: [],
    } satisfies PresentedReport;
  }

  async presentCF(
    req: Request,
    params: {
      from: string;
      to: string;
      compare?: 'prior_month' | 'prior_year';
    },
  ) {
    const current = await this.engine.computeCashFlowIndirect(req, {
      from: params.from,
      to: params.to,
    });

    let compare: null | Awaited<
      ReturnType<FinancialStatementsService['computeCashFlowIndirect']>
    > = null;
    let comparePeriod: PresentedReport['comparePeriod'] | undefined;
    let compareOmittedReason: string | undefined;

    if (params.compare) {
      const cFrom = this.addMonths(
        params.from,
        params.compare === 'prior_month' ? -1 : -12,
      );
      const cTo = this.addMonths(
        params.to,
        params.compare === 'prior_month' ? -1 : -12,
      );
      try {
        compare = await this.engine.computeCashFlowIndirect(req, {
          from: cFrom,
          to: cTo,
        });
        comparePeriod = { from: compare.from, to: compare.to };
      } catch (e: any) {
        compareOmittedReason =
          e?.message ?? 'Comparison omitted due to controls';
      }
    }

    const opRows: PresentedRow[] = [
      {
        key: 'profit_before_tax',
        label: 'Profit before tax',
        amount: this.present(current.operating.profitBeforeTax),
        compareAmount: compare
          ? this.present(compare.operating.profitBeforeTax)
          : undefined,
      },
      ...current.operating.adjustments.map((a) => ({
        key: `adj:${a.label}`,
        label: a.label,
        amount: this.present(a.amount),
        compareAmount: compare
          ? this.present(
              compare.operating.adjustments.find((x) => x.label === a.label)
                ?.amount ?? 0,
            )
          : undefined,
      })),
      ...current.operating.workingCapital.map((a) => ({
        key: `wc:${a.label}`,
        label: a.label,
        amount: this.present(a.amount),
        compareAmount: compare
          ? this.present(
              compare.operating.workingCapital.find((x) => x.label === a.label)
                ?.amount ?? 0,
            )
          : undefined,
      })),
    ];

    const invRows: PresentedRow[] = (current.investing.rows ?? []).map((r) => ({
      key: `inv:${r.label}`,
      label: r.label,
      amount: this.present(r.amount),
      compareAmount: compare
        ? this.present(
            (compare.investing.rows ?? []).find((x) => x.label === r.label)
              ?.amount ?? 0,
          )
        : undefined,
    }));

    const finRows: PresentedRow[] = (current.financing.rows ?? []).map((r) => ({
      key: `fin:${r.label}`,
      label: r.label,
      amount: this.present(r.amount),
      compareAmount: compare
        ? this.present(
            (compare.financing.rows ?? []).find((x) => x.label === r.label)
              ?.amount ?? 0,
          )
        : undefined,
    }));

    const netChangeFromSections =
      current.operating.netCashFromOperating +
      current.investing.netCashFromInvesting +
      current.financing.netCashFromFinancing;
    const unclassified = current.cash.netChangeInCash - netChangeFromSections;

    const compareNetChangeFromSections = compare
      ? compare.operating.netCashFromOperating +
        compare.investing.netCashFromInvesting +
        compare.financing.netCashFromFinancing
      : 0;
    const compareUnclassified = compare
      ? compare.cash.netChangeInCash - compareNetChangeFromSections
      : 0;

    return {
      reportType: 'CF' as const,
      title: 'Cash Flow (Indirect)',
      period: { from: current.from, to: current.to },
      comparePeriod,
      compareOmittedReason,
      sections: [
        {
          key: 'operating',
          label: 'Cash flows from operating activities',
          rows: opRows,
          subtotal: {
            key: 'net_cash_ops',
            label:
              current.operating.netCashFromOperating >= 0
                ? 'Net cash generated from operating activities'
                : 'Net cash used in operating activities',
            amount: this.present(current.operating.netCashFromOperating),
            compareAmount: compare
              ? this.present(compare.operating.netCashFromOperating)
              : undefined,
          },
        },
        {
          key: 'investing',
          label: 'Cash flows from investing activities',
          rows: invRows,
          subtotal: {
            key: 'net_cash_investing',
            label: 'Net cash used in / from investing activities',
            amount: this.present(current.investing.netCashFromInvesting),
            compareAmount: compare
              ? this.present(compare.investing.netCashFromInvesting)
              : undefined,
          },
        },
        {
          key: 'financing',
          label: 'Cash flows from financing activities',
          rows: finRows,
          subtotal: {
            key: 'net_cash_financing',
            label: 'Net cash from / used in financing activities',
            amount: this.present(current.financing.netCashFromFinancing),
            compareAmount: compare
              ? this.present(compare.financing.netCashFromFinancing)
              : undefined,
          },
        },
        {
          key: 'reconciliation',
          label: 'Cash and cash equivalents reconciliation',
          rows: [
            {
              key: 'net_cash_ops',
              label: 'Net cash generated from operating activities',
              amount: this.present(current.operating.netCashFromOperating),
              compareAmount: compare
                ? this.present(compare.operating.netCashFromOperating)
                : undefined,
            },
            {
              key: 'net_cash_inv',
              label: 'Net cash used in / from investing activities',
              amount: this.present(current.investing.netCashFromInvesting),
              compareAmount: compare
                ? this.present(compare.investing.netCashFromInvesting)
                : undefined,
            },
            {
              key: 'net_cash_fin',
              label: 'Net cash from / used in financing activities',
              amount: this.present(current.financing.netCashFromFinancing),
              compareAmount: compare
                ? this.present(compare.financing.netCashFromFinancing)
                : undefined,
            },
            {
              key: 'unclassified_cash_movements',
              label: 'Unclassified cash movements',
              amount: this.present(unclassified),
              compareAmount: compare
                ? this.present(compareUnclassified)
                : undefined,
            },
            {
              key: 'net_change_cash',
              label: 'Net increase / (decrease) in cash and cash equivalents',
              amount: this.present(current.cash.netChangeInCash),
              compareAmount: compare
                ? this.present(compare.cash.netChangeInCash)
                : undefined,
            },
            {
              key: 'opening_cash',
              label: 'Opening cash and cash equivalents',
              amount: this.present(current.cash.openingCash),
              compareAmount: compare
                ? this.present(compare.cash.openingCash)
                : undefined,
            },
          ],
          subtotal: {
            key: 'closing_cash',
            label: 'Closing cash and cash equivalents',
            amount: this.present(current.cash.closingCash),
            compareAmount: compare
              ? this.present(compare.cash.closingCash)
              : undefined,
          },
        },
      ],
      totals: [],
    } satisfies PresentedReport;
  }
}
