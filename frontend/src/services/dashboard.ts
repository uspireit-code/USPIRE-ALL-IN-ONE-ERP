import { apiFetch } from './api';

export type DashboardKpisResponse = {
  context: { asOf: string; fiscalYear: number };
  kpis: {
    revenue: { ytd: number; mtd: number };
    expenses: { ytd: number; mtd: number };
    netProfit: { ytd: number; mtd: number };
    budgetVsActualYtd: {
      budgetId: string | null;
      budgetTotalYtd: number | null;
      actualTotalYtd: number | null;
      varianceAmountYtd: number | null;
      variancePercentYtd: number | null;
    };
    forecastVsActualYtd: {
      forecastId: string | null;
      forecastTotalYtd: number | null;
      actualTotalYtd: number | null;
      varianceAmountYtd: number | null;
      variancePercentYtd: number | null;
    };
    cashBalance: number;
    arBalance: number;
    apBalance: number;
  };
};

export type DashboardTrendsResponse = {
  context: { asOf: string; fiscalYear: number };
  byMonth: Array<{ month: number; revenue: number | null; expenses: number | null; profit: number | null }>;
};

export async function getDashboardKpis(params?: { asOf?: string; fiscalYear?: number }) {
  const qs = new URLSearchParams();
  if (params?.asOf) qs.set('asOf', params.asOf);
  if (typeof params?.fiscalYear === 'number') qs.set('fiscalYear', String(params.fiscalYear));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<DashboardKpisResponse>(`/dashboard/kpis${suffix}`, { method: 'GET' });
}

export async function getDashboardTrends(params?: { asOf?: string; fiscalYear?: number }) {
  const qs = new URLSearchParams();
  if (params?.asOf) qs.set('asOf', params.asOf);
  if (typeof params?.fiscalYear === 'number') qs.set('fiscalYear', String(params.fiscalYear));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<DashboardTrendsResponse>(`/dashboard/trends${suffix}`, { method: 'GET' });
}
