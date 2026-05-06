import { apiFetch } from './api';

export type CoaRootCategory = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  ifrsMappingCode: string | null;
  fsMappingLevel1: string | null;
  fsMappingLevel2: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
};

export async function listCoaRootCategories(): Promise<{ rootCategories: CoaRootCategory[] }> {
  return apiFetch<{ rootCategories: CoaRootCategory[] }>('/finance/coa/root-categories', { method: 'GET' });
}

export async function createCoaRootCategory(params: {
  code: string;
  name: string;
  accountType: CoaRootCategory['accountType'];
  ifrsMappingCode?: string | null;
  fsMappingLevel1?: string | null;
  fsMappingLevel2?: string | null;
}): Promise<{ rootCategory: CoaRootCategory; account: any }> {
  return apiFetch('/finance/coa/root-categories', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateCoaRootCategory(params: {
  id: string;
  name?: string;
  ifrsMappingCode?: string | null;
  fsMappingLevel1?: string | null;
  fsMappingLevel2?: string | null;
}): Promise<{ rootCategory: CoaRootCategory; account: any }> {
  return apiFetch(`/finance/coa/root-categories/${params.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: params.name,
      ifrsMappingCode: params.ifrsMappingCode,
      fsMappingLevel1: params.fsMappingLevel1,
      fsMappingLevel2: params.fsMappingLevel2,
    }),
  });
}

export async function disableCoaRootCategory(params: { id: string; force?: boolean }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/root-categories/${params.id}/disable`, {
    method: 'POST',
    body: JSON.stringify({ force: params.force }),
  });
}

export async function setupDefaultCoaRootCategories(): Promise<{
  createdCount: number;
  skippedCount: number;
  createdRoots: Array<{ rootCategory: CoaRootCategory; accountId: string }>;
}> {
  return apiFetch('/finance/coa/root-categories/setup-default', {
    method: 'POST',
  });
}
