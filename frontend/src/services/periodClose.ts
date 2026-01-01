import { apiFetch } from './api';

export type PeriodCloseChecklistItem = {
  id: string;
  code: string;
  name: string;
  status: 'PENDING' | 'COMPLETED';
  completedAt: string | null;
  completedBy: null | { id: string; email: string };
  createdAt: string;
};

export type PeriodCloseChecklistResponse = {
  period: {
    id: string;
    name: string;
    status: 'OPEN' | 'CLOSED';
  };
  checklist: {
    id: string;
    periodId: string;
    createdAt: string;
    items: PeriodCloseChecklistItem[];
  };
};

export async function getPeriodCloseChecklist(periodId: string) {
  return apiFetch<PeriodCloseChecklistResponse>(`/period-close/checklist/${periodId}`, { method: 'GET' });
}

export async function completePeriodCloseChecklistItem(params: { periodId: string; itemId: string }) {
  return apiFetch<PeriodCloseChecklistItem>(
    `/period-close/checklist/${params.periodId}/items/${params.itemId}/complete`,
    { method: 'POST' },
  );
}
