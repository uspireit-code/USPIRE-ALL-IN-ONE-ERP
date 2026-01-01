import { apiFetch } from './api';

export type FixedAssetCategory = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  defaultMethod: string;
  defaultUsefulLifeMonths: number;
  defaultResidualRate?: string | null;
  assetAccountId: string;
  accumDepAccountId: string;
  depExpenseAccountId: string;
  createdAt: string;
};

export type FixedAsset = {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  createdById: string;
  acquisitionDate: string;
  capitalizationDate?: string | null;
  cost: string;
  residualValue: string;
  usefulLifeMonths: number;
  method: string;
  status: 'DRAFT' | 'CAPITALIZED' | 'DISPOSED';
  assetAccountId?: string | null;
  accumDepAccountId?: string | null;
  depExpenseAccountId?: string | null;
  vendorId?: string | null;
  apInvoiceId?: string | null;
  capitalizationJournalId?: string | null;
  disposalJournalId?: string | null;
  createdAt: string;
  category?: FixedAssetCategory;
};

export type DepreciationRun = {
  id: string;
  tenantId: string;
  periodId: string;
  runDate: string;
  postedById: string;
  status: 'POSTED';
  journalEntryId?: string | null;
  period?: any;
  lines?: Array<{ id: string; assetId: string; amount: string }>;
};

export async function listFaCategories() {
  return apiFetch<FixedAssetCategory[]>('/fa/categories', { method: 'GET' });
}

export async function createFaCategory(params: {
  code: string;
  name: string;
  defaultMethod: 'STRAIGHT_LINE';
  defaultUsefulLifeMonths: number;
  defaultResidualRate?: string;
  assetAccountId: string;
  accumDepAccountId: string;
  depExpenseAccountId: string;
}) {
  return apiFetch<FixedAssetCategory>('/fa/categories', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listFaAssets() {
  return apiFetch<FixedAsset[]>('/fa/assets', { method: 'GET' });
}

export async function createFaAsset(params: {
  categoryId: string;
  name: string;
  description?: string;
  acquisitionDate: string;
  cost: string;
  residualValue: string;
  usefulLifeMonths: number;
  method: 'STRAIGHT_LINE';
  vendorId?: string;
  apInvoiceId?: string;
}) {
  return apiFetch<FixedAsset>('/fa/assets', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function capitalizeFaAsset(assetId: string, params: {
  capitalizationDate: string;
  assetAccountId: string;
  accumDepAccountId: string;
  depExpenseAccountId: string;
  clearingAccountId: string;
}) {
  return apiFetch<FixedAsset>(`/fa/assets/${encodeURIComponent(assetId)}/capitalize`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function runFaDepreciation(periodId: string) {
  return apiFetch<any>(`/fa/depreciation/run?periodId=${encodeURIComponent(periodId)}`, { method: 'POST' });
}

export async function listFaDepreciationRuns() {
  return apiFetch<DepreciationRun[]>('/fa/depreciation/runs', { method: 'GET' });
}

export async function disposeFaAsset(assetId: string, params: {
  disposalDate: string;
  proceeds: string;
  proceedsAccountId: string;
  gainLossAccountId: string;
}) {
  return apiFetch<FixedAsset>(`/fa/assets/${encodeURIComponent(assetId)}/dispose`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
