import { apiFetch } from './api';

export type ArAgingReportRow = {
  customerId: string;
  customerName: string;
  current: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
};

export type ArAgingReportResponse = {
  asOf: string;
  buckets: Array<'CURRENT' | '0_30' | '31_60' | '61_90' | '90_PLUS'>;
  rows: ArAgingReportRow[];
  totals: {
    current: number;
    b0_30: number;
    b31_60: number;
    b61_90: number;
    b90_plus: number;
    total: number;
  };
};

export function getArAgingReport(params: { asOf?: string; customerId?: string }) {
  const qs = new URLSearchParams();
  if (params.asOf) qs.set('asOf', params.asOf);
  if (params.customerId) qs.set('customerId', params.customerId);
  const query = qs.toString();
  return apiFetch<ArAgingReportResponse>(`/ar/aging${query ? `?${query}` : ''}`, { method: 'GET' });
}
