import { apiFetch, apiFetchRaw } from './api';

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
};

export type TrialBalanceResponse = {
  from: string;
  to: string;
  totals: {
    totalDebit: number;
    totalCredit: number;
    net: number;
  };
  rows: TrialBalanceRow[];
};

export type ProfitLossRow = {
  accountCode: string;
  accountName: string;
  balance: number;
};

export type ProfitLossResponse = {
  from: string;
  to: string;
  income: { total: number; rows: ProfitLossRow[] };
  expenses: { total: number; rows: ProfitLossRow[] };
  profitOrLoss: number;
};

export type PnlResponse = ProfitLossResponse;

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

export type PresentedReportResponse = {
  entityId: string;
  report: PresentedReport;
};

export type BalanceSheetRow = {
  accountCode: string;
  accountName: string;
  balance: number;
};

export type BalanceSheetResponse = {
  asOf: string;
  assets: { total: number; rows: BalanceSheetRow[] };
  liabilities: { total: number; rows: BalanceSheetRow[] };
  equity: { total: number; rows: BalanceSheetRow[] };
  equation: {
    assets: number;
    liabilitiesPlusEquity: number;
    balanced: boolean;
  };
};

export type SoceResponse = {
  fiscalYear: number;
  from: string;
  to: string;
  shareCapital: {
    opening: number;
    profitOrLoss: number;
    otherMovements: number;
    closing: number;
  };
  retainedEarnings: {
    opening: number;
    profitOrLoss: number;
    otherMovements: number;
    closing: number;
  };
  otherReserves: {
    opening: number;
    profitOrLoss: number;
    otherMovements: number;
    closing: number;
  };
  totalEquity: {
    opening: number;
    profitOrLoss: number;
    otherMovements: number;
    closing: number;
  };
};

export type CashFlowIndirectResponse = {
  from: string;
  to: string;
  operating: {
    netProfit: number;
    adjustments: Array<{ label: string; amount: number }>;
    workingCapital: Array<{ label: string; amount: number }>;
    netCashFromOperating: number;
  };
  cash: {
    openingCash: number;
    closingCash: number;
    netChangeInCash: number;
  };
};

export type AgingBucket = { code: string; label: string };

export type ApAgingInvoiceRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysPastDue: number;
  totalAmount: number;
  paidToDate: number;
  outstanding: number;
  bucket: string;
};

export type ApAgingSupplierGroup = {
  supplierId: string;
  supplierName: string;
  totalsByBucket: Record<string, number>;
  totalOutstanding: number;
  invoices: ApAgingInvoiceRow[];
};

export type ApAgingResponse = {
  asOf: string;
  buckets: AgingBucket[];
  grandTotalsByBucket: Record<string, number>;
  grandTotalOutstanding: number;
  suppliers: ApAgingSupplierGroup[];
};

export type ArAgingInvoiceRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysPastDue: number;
  totalAmount: number;
  receivedToDate: number;
  outstanding: number;
  bucket: string;
};

export type ArAgingCustomerGroup = {
  customerId: string;
  customerName: string;
  totalsByBucket: Record<string, number>;
  totalOutstanding: number;
  invoices: ArAgingInvoiceRow[];
};

export type ArAgingResponse = {
  asOf: string;
  buckets: AgingBucket[];
  grandTotalsByBucket: Record<string, number>;
  grandTotalOutstanding: number;
  customers: ArAgingCustomerGroup[];
};

export type VatSummaryResponse = {
  from: string;
  to: string;
  totalOutputVat: number;
  totalInputVat: number;
  netVat: number;
  netPosition: 'PAYABLE' | 'RECEIVABLE';
};

export function getTrialBalance(params: { from: string; to: string }) {
  return apiFetch<TrialBalanceResponse>(
    `/gl/trial-balance?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
    { method: 'GET' },
  );
}

export function getProfitLoss(params: { from: string; to: string }) {
  return apiFetch<ProfitLossResponse>(
    `/reports/profit-loss-legacy?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
    { method: 'GET' },
  );
}

export function getPnl(params: { from: string; to: string }) {
  return apiFetch<PnlResponse>(`/reports/pnl?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`, {
    method: 'GET',
  });
}

export function getBalanceSheet(params: { asOf: string }) {
  return apiFetch<BalanceSheetResponse>(`/reports/balance-sheet-legacy?asOf=${encodeURIComponent(params.asOf)}`, { method: 'GET' });
}

export function getBalanceSheetV2(params: { asOf: string }) {
  return apiFetch<BalanceSheetResponse>(`/reports/balance-sheet?asOf=${encodeURIComponent(params.asOf)}`, { method: 'GET' });
}

export function getSoceEngine(params: { fiscalYear: number }) {
  return apiFetch<SoceResponse>(`/reports/soce-engine?fiscalYear=${encodeURIComponent(String(params.fiscalYear))}`, { method: 'GET' });
}

export function getCashFlowEngine(params: { from: string; to: string }) {
  return apiFetch<CashFlowIndirectResponse>(
    `/reports/cash-flow?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
    { method: 'GET' },
  );
}

export function getProfitLossPresented(params: { from: string; to: string; compare?: 'prior_month' | 'prior_year' }) {
  const compare = params.compare ? `&compare=${encodeURIComponent(params.compare)}` : '';
  return apiFetch<PresentedReportResponse>(
    `/reports/pl?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}${compare}`,
    { method: 'GET' },
  );
}

export function getBalanceSheetPresented(params: { asOf: string; compare?: 'prior_month' | 'prior_year' }) {
  const compare = params.compare ? `&compare=${encodeURIComponent(params.compare)}` : '';
  return apiFetch<PresentedReportResponse>(`/reports/bs?asOf=${encodeURIComponent(params.asOf)}${compare}`, { method: 'GET' });
}

export function getSocePresented(params: { fiscalYear: number; compare?: 'prior_year' }) {
  const compare = params.compare ? `&compare=${encodeURIComponent(params.compare)}` : '';
  return apiFetch<PresentedReportResponse>(
    `/reports/soce?fiscalYear=${encodeURIComponent(String(params.fiscalYear))}${compare}`,
    { method: 'GET' },
  );
}

export function getCashFlowPresented(params: { from: string; to: string; compare?: 'prior_month' | 'prior_year' }) {
  const compare = params.compare ? `&compare=${encodeURIComponent(params.compare)}` : '';
  return apiFetch<PresentedReportResponse>(
    `/reports/cf?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}${compare}`,
    { method: 'GET' },
  );
}

export type ReportExportFormat = 'pdf' | 'csv' | 'xlsx';

function parseContentDispositionFilename(contentDisposition: string): string | null {
  const cd = contentDisposition ?? '';

  const filenameStar = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
  if (filenameStar?.[1]) {
    try {
      return decodeURIComponent(filenameStar[1].trim());
    } catch {
      return filenameStar[1].trim();
    }
  }

  const filename = /filename="?([^";\n]+)"?/i.exec(cd);
  return filename?.[1]?.trim() ?? null;
}

export async function downloadReportExport(params: {
  type: 'pl' | 'bs' | 'soce' | 'cf';
  format: ReportExportFormat;
  query: Record<string, string | number | undefined>;
}) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params.query)) {
    if (v === undefined || v === null || v === '') continue;
    qp.set(k, String(v));
  }
  qp.set('format', params.format);

  const res = await apiFetchRaw(`/reports/${params.type}/export?${qp.toString()}`, { method: 'GET' });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers.get('Content-Disposition') ?? '';

  const headerFilename = parseContentDispositionFilename(cd);

  const fallbackFilename = (() => {
    if (params.type === 'pl') {
      const from = params.query.from ? String(params.query.from) : '';
      const to = params.query.to ? String(params.query.to) : '';
      if (from && to) {
        return `Statement_of_Profit_or_Loss_${from}_to_${to}.${params.format}`;
      }
      return `Statement_of_Profit_or_Loss.${params.format}`;
    }
    return `${params.type}.${params.format}`;
  })();

  a.download = headerFilename ?? fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTrialBalanceExport(params: {
  format: 'pdf' | 'xlsx';
  from: string;
  to: string;
}) {
  const qp = new URLSearchParams();
  qp.set('from', params.from);
  qp.set('to', params.to);
  qp.set('format', params.format);

  const res = await apiFetchRaw(`/gl/trial-balance/export?${qp.toString()}`, { method: 'GET' });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(cd);
  a.download = match?.[1] ?? `trial_balance.${params.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getApAging(params: { asOf: string }) {
  return apiFetch<ApAgingResponse>(`/reports/ap-aging?asOf=${encodeURIComponent(params.asOf)}`, { method: 'GET' });
}

export function getArAging(params: { asOf: string }) {
  return apiFetch<ArAgingResponse>(`/reports/ar-aging?asOf=${encodeURIComponent(params.asOf)}`, { method: 'GET' });
}

export function getVatSummary(params: { from: string; to: string }) {
  return apiFetch<VatSummaryResponse>(
    `/reports/vat-summary?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
    { method: 'GET' },
  );
}
