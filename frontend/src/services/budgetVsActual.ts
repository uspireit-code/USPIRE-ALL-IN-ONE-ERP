import { apiFetch } from './api';

export type BudgetVsActualVarianceStatus = 'OK' | 'WARN' | 'OVER';

export type BudgetVsActualPagedRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  periodId: string;
  periodName: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercent: number | null;
  varianceStatus: BudgetVsActualVarianceStatus;
};

export type BudgetVsActualPagedResponse = {
  fiscalYear: number;
  budgetId: string;
  revision: { id: string; revisionNo: number; createdAt: string };
  cutoverDate: string | null;
  rows: BudgetVsActualPagedRow[];
  total: number;
  limit: number;
  offset: number;
};

export async function getBudgetVsActualPaged(params: {
  fiscalYear: number;
  periodId?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}) {
  const qs = new URLSearchParams();
  qs.set('fiscalYear', String(params.fiscalYear));
  if (params.periodId) qs.set('periodId', params.periodId);
  if (params.accountId) qs.set('accountId', params.accountId);
  if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
  if (typeof params.offset === 'number') qs.set('offset', String(params.offset));
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  return apiFetch<BudgetVsActualPagedResponse>(`/budgets/vs-actual?${qs.toString()}`, { method: 'GET' });
}

export type BudgetVsActualJournalRow = {
  journalEntryId: string;
  journalNumber: number | null;
  journalDate: string;
  reference: string | null;
  description: string | null;
  postedAt: string | null;
  amount: number;
};

export type BudgetVsActualJournalsResponse = {
  account: { id: string; code: string; name: string };
  period: { id: string; name: string; startDate: string; endDate: string };
  rows: BudgetVsActualJournalRow[];
  total: number;
  limit: number;
  offset: number;
};

export async function getBudgetVsActualJournals(params: {
  accountId: string;
  periodId: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
  if (typeof params.offset === 'number') qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<BudgetVsActualJournalsResponse>(
    `/budgets/vs-actual/${encodeURIComponent(params.accountId)}/${encodeURIComponent(params.periodId)}/journals${suffix}`,
    { method: 'GET' },
  );
}
