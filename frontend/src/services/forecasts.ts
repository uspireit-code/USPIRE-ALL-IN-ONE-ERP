import { apiFetch } from './api';

export type ForecastStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SUPERSEDED';

export type ForecastListRow = {
  id: string;
  tenantId: string;
  fiscalYear: number;
  name: string;
  status: ForecastStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string };
};

export type ForecastVersionRow = {
  id: string;
  forecastId: string;
  versionNumber: number;
  status: ForecastStatus;
  createdAt: string;
  createdBy: { id: string; email: string };
};

export type ForecastLineRow = {
  id: string;
  accountId: string;
  month: number;
  amount: string;
  account: { id: string; code: string; name: string };
};

export type ForecastDetailsResponse = {
  forecast: ForecastListRow;
  versions: ForecastVersionRow[];
  latestVersion: ForecastVersionRow | null;
  lines: ForecastLineRow[];
};

export type ForecastActualsResponse = {
  forecastId: string;
  fiscalYear: number;
  forecastVersionId: string;
  rows: Array<{ accountId: string; byMonth: Record<string, number | null> }>;
};

export type ForecastVarianceCell = {
  forecastAmount: number;
  actualAmount: number | null;
  varianceAmount: number | null;
  variancePercent: number | null;
};

export type ForecastVarianceResponse = {
  forecastId: string;
  fiscalYear: number;
  forecastVersionId: string;
  rows: Array<{ accountId: string; byMonth: Record<string, ForecastVarianceCell> }>;
};

export type ForecastLineInput = {
  accountId: string;
  month: number;
  amount: number;
};

export async function createForecast(payload: { fiscalYear: number; name: string; lines: ForecastLineInput[] }) {
  return apiFetch<{ forecast: ForecastListRow; version: { id: string; versionNumber: number; status: ForecastStatus; createdAt: string } }>(
    `/forecasts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function updateForecastLines(forecastId: string, payload: { lines: ForecastLineInput[] }) {
  return apiFetch<ForecastListRow>(`/forecasts/${encodeURIComponent(forecastId)}/lines`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitForecast(forecastId: string) {
  return apiFetch<{ forecast: ForecastListRow; version: { id: string; forecastId: string; versionNumber: number; status: ForecastStatus; createdAt: string } }>(
    `/forecasts/${encodeURIComponent(forecastId)}/submit`,
    { method: 'POST' },
  );
}

export async function approveForecast(forecastId: string) {
  return apiFetch<{ forecast: ForecastListRow; version: { id: string; forecastId: string; versionNumber: number; status: ForecastStatus; createdAt: string } }>(
    `/forecasts/${encodeURIComponent(forecastId)}/approve`,
    { method: 'POST' },
  );
}

export async function listForecasts(params?: { fiscalYear?: number }) {
  const qs = params?.fiscalYear ? `?fiscalYear=${encodeURIComponent(String(params.fiscalYear))}` : '';
  return apiFetch<ForecastListRow[]>(`/forecasts${qs}`, { method: 'GET' });
}

export async function getForecast(id: string) {
  return apiFetch<ForecastDetailsResponse>(`/forecasts/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function getForecastActuals(id: string) {
  return apiFetch<ForecastActualsResponse>(`/forecasts/${encodeURIComponent(id)}/actuals`, { method: 'GET' });
}

export async function getForecastVariance(id: string) {
  return apiFetch<ForecastVarianceResponse>(`/forecasts/${encodeURIComponent(id)}/variance`, { method: 'GET' });
}
