import { apiFetch } from './api';

export type ApAgingRow = {
  supplierId: string;
  supplierName: string;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_91_plus: number;
  totalOutstanding: number;
};

export function getApAging(params: { asOfDate: string; supplierId?: string }) {
  const qs = new URLSearchParams();
  qs.set('asOfDate', params.asOfDate);
  if (params.supplierId) qs.set('supplierId', params.supplierId);

  return apiFetch<ApAgingRow[]>(`/ap/aging?${qs.toString()}`, { method: 'GET' });
}
