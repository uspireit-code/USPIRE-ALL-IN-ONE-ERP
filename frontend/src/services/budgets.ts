import { apiFetch } from './api';

export type BudgetStatus = 'DRAFT' | 'ACTIVE';

export type BudgetListRow = {
  id: string;
  tenantId: string;
  fiscalYear: number;
  status: BudgetStatus;
  createdAt: string;
  approvedAt: string | null;
  createdBy: { id: string; email: string };
  approvedBy: { id: string; email: string } | null;
};

export type BudgetRevisionRow = {
  id: string;
  revisionNo: number;
  createdAt: string;
  createdBy: { id: string; email: string };
};

export type BudgetLineRow = {
  id: string;
  accountId: string;
  periodId: string;
  amount: string;
  account: { id: string; code: string; name: string };
  period: { id: string; name: string; startDate: string; endDate: string };
};

export type BudgetDetailsResponse = {
  budget: BudgetListRow;
  revisions: BudgetRevisionRow[];
  latestRevision: BudgetRevisionRow | null;
  lines: BudgetLineRow[];
};

export async function listBudgets(params?: { fiscalYear?: number }) {
  const qs = params?.fiscalYear ? `?fiscalYear=${encodeURIComponent(String(params.fiscalYear))}` : '';
  return apiFetch<BudgetListRow[]>(`/budgets${qs}`, { method: 'GET' });
}

export async function getBudget(id: string) {
  return apiFetch<BudgetDetailsResponse>(`/budgets/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createBudget(payload: { fiscalYear: number; lines: Array<{ accountId: string; periodId: string; amount: number }> }) {
  return apiFetch<{ budget: BudgetListRow; revision: BudgetRevisionRow }>(`/budgets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function approveBudget(id: string) {
  return apiFetch<BudgetListRow>(`/budgets/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}
