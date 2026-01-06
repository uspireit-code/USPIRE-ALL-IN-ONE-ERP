import { apiFetch } from './api';

export type TaxRateType = 'OUTPUT' | 'INPUT';

export type TaxRate = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  rate: number;
  type: TaxRateType;
  isActive: boolean;
  glAccountId: string | null;
  glAccount?: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
  createdAt: string;
};

export type TenantTaxConfig = {
  tenantId: string;
  outputVatAccountId: string | null;
  inputVatAccountId: string | null;
  outputVatAccount?: { id: string; code: string; name: string; type: string } | null;
  inputVatAccount?: { id: string; code: string; name: string; type: string } | null;
};

export async function listTaxRates() {
  const res = await apiFetch<{ items: TaxRate[] }>('/finance/tax/rates', {
    method: 'GET',
  });
  return res?.items ?? [];
}

export async function getTaxRateById(id: string) {
  return apiFetch<TaxRate>(`/finance/tax/rates/${id}`, { method: 'GET' });
}

export async function createTaxRate(params: {
  code: string;
  name: string;
  rate: number;
  type: TaxRateType;
  glAccountId?: string;
}) {
  return apiFetch<TaxRate>('/finance/tax/rates', {
    method: 'POST',
    body: JSON.stringify({
      code: params.code,
      name: params.name,
      rate: params.rate,
      type: params.type,
      glAccountId: params.glAccountId || undefined,
    }),
  });
}

export async function updateTaxRate(
  id: string,
  params: {
    code?: string;
    name?: string;
    rate?: number;
    type?: TaxRateType;
    glAccountId?: string | null;
  },
) {
  return apiFetch<TaxRate>(`/finance/tax/rates/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      code: params.code,
      name: params.name,
      rate: params.rate,
      type: params.type,
      glAccountId: params.glAccountId,
    }),
  });
}

export async function setTaxRateActive(id: string, isActive: boolean) {
  return apiFetch<TaxRate>(`/finance/tax/rates/${id}/active`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });
}

export async function getTenantTaxConfig() {
  return apiFetch<TenantTaxConfig>('/finance/tax/config', { method: 'GET' });
}

export async function updateTenantTaxConfig(params: {
  outputVatAccountId?: string | null;
  inputVatAccountId?: string | null;
}) {
  return apiFetch<TenantTaxConfig>('/finance/tax/config', {
    method: 'PUT',
    body: JSON.stringify({
      outputVatAccountId: params.outputVatAccountId,
      inputVatAccountId: params.inputVatAccountId,
    }),
  });
}
