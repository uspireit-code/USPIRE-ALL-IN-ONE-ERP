import { apiFetch } from './api';

export type PeriodType = 'OPENING' | 'NORMAL';
export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';

export type AccountingPeriod = {
  id: string;
  tenantId: string;
  code: string | null;
  name: string;
  startDate: string;
  endDate: string;
  type: PeriodType;
  status: PeriodStatus;
  createdById?: string | null;
  closedById?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePeriodPayload = {
  code: string;
  name?: string;
  type: PeriodType;
  startDate: string;
  endDate: string;
};

export type AccountingPeriodChecklistItem = {
  id: string;
  code: string;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt: string | null;
  completedBy: null | { id: string; email: string };
  createdAt: string;
};

export type AccountingPeriodChecklistResponse = {
  period: {
    id: string;
    name: string;
    status: PeriodStatus;
    startDate: string;
    endDate: string;
    closedAt: string | null;
    closedBy: null | { id: string; email: string };
  };
  items: AccountingPeriodChecklistItem[];
  summary?: {
    requiredTotal: number;
    requiredCompleted: number;
    requiredOutstanding: number;
    readyToClose: boolean;
  };
};

export async function listPeriods() {
  return apiFetch<AccountingPeriod[]>('/periods', { method: 'GET' });
}

export async function createPeriod(payload: CreatePeriodPayload) {
  return apiFetch<AccountingPeriod>('/periods', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function closePeriod(id: string) {
  return apiFetch<AccountingPeriod>(`/periods/${id}/close`, { method: 'POST' });
}

export async function reopenPeriod(id: string, payload: { reason: string }) {
  return apiFetch<AccountingPeriod>(`/periods/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPeriodChecklist(id: string) {
  return apiFetch<AccountingPeriodChecklistResponse>(`/periods/${id}/checklist`, {
    method: 'GET',
  });
}

export async function completePeriodChecklistItem(params: {
  periodId: string;
  itemId: string;
}) {
  return apiFetch<AccountingPeriodChecklistItem>(
    `/periods/${params.periodId}/checklist/items/${params.itemId}/complete`,
    { method: 'POST' },
  );
}
