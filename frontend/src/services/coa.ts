import { apiFetch, apiFetchRaw } from './api';

export type CoaAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type NormalBalance = 'DEBIT' | 'CREDIT';

export type BudgetControlMode = 'WARN' | 'BLOCK';

export type CoaAccount = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: CoaAccountType;
  subCategory: string | null;
  fsMappingLevel1: string | null;
  fsMappingLevel2: string | null;
  parentAccountId: string | null;
  isPosting: boolean;
  isPostingAllowed: boolean;
  isControlAccount: boolean;
  normalBalance: NormalBalance;
  hierarchyPath: string | null;
  isActive: boolean;
  isFrozen: boolean;
  ifrsMappingCode: string | null;
  isBudgetRelevant: boolean;
  budgetControlMode: BudgetControlMode;
  createdAt: string;
  createdById: string | null;
  updatedAt: string;
};

export type CoaListResponse = {
  coaFrozen: boolean;
  coaLockedAt: string | null;
  accounts: CoaAccount[];
};

export type CoaTreeNode = {
  id: string;
  code: string;
  name: string;
  type: CoaAccountType;
  subCategory: string | null;
  fsMappingLevel1: string | null;
  fsMappingLevel2: string | null;
  parentAccountId: string | null;
  isPosting: boolean;
  isPostingAllowed: boolean;
  isControlAccount: boolean;
  normalBalance: NormalBalance;
  hierarchyPath: string | null;
  isActive: boolean;
  isBudgetRelevant: boolean;
  budgetControlMode: BudgetControlMode;
  children: CoaTreeNode[];
};

export type CoaTreeResponse = {
  coaFrozen: boolean;
  coaLockedAt: string | null;
  tree: CoaTreeNode[];
};

export async function listCoa(): Promise<CoaListResponse> {
  return apiFetch<CoaListResponse>('/finance/coa', { method: 'GET' });
}

export async function getCoaTree(): Promise<CoaTreeResponse> {
  return apiFetch<CoaTreeResponse>('/finance/coa/tree', { method: 'GET' });
}

export async function createCoaAccount(params: {
  code: string;
  name: string;
  accountType: CoaAccountType;
  subCategory?: string;
  fsMappingLevel1?: string;
  fsMappingLevel2?: string;
  parentAccountId?: string | null;
  isPosting?: boolean;
  isPostingAllowed?: boolean;
  isControlAccount?: boolean;
  normalBalance?: NormalBalance;
  isActive?: boolean;
  isBudgetRelevant?: boolean;
  budgetControlMode?: BudgetControlMode;
}): Promise<CoaAccount> {
  return apiFetch<CoaAccount>('/finance/coa', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateCoaAccount(params: {
  id: string;
  code?: string;
  name?: string;
  accountType?: CoaAccountType;
  subCategory?: string;
  fsMappingLevel1?: string;
  fsMappingLevel2?: string;
  parentAccountId?: string | null;
  isPosting?: boolean;
  isPostingAllowed?: boolean;
  isControlAccount?: boolean;
  normalBalance?: NormalBalance;
  isActive?: boolean;
  ifrsMappingCode?: string | null;
  isBudgetRelevant?: boolean;
  budgetControlMode?: BudgetControlMode;
}): Promise<CoaAccount> {
  const { id, ...body } = params;
  return apiFetch<CoaAccount>(`/finance/coa/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function freezeCoa(): Promise<{ id: string; coaFrozen: boolean }> {
  return apiFetch<{ id: string; coaFrozen: boolean }>('/finance/coa/freeze', {
    method: 'POST',
  });
}

export async function unfreezeCoa(): Promise<{ id: string; coaFrozen: boolean }> {
  return apiFetch<{ id: string; coaFrozen: boolean }>('/finance/coa/unfreeze', {
    method: 'POST',
  });
}

export async function lockCoa(): Promise<{ id: string; coaLockedAt: string | null }> {
  return apiFetch<{ id: string; coaLockedAt: string | null }>('/finance/coa/lock', {
    method: 'POST',
  });
}

export async function unlockCoa(params?: { reason?: string }): Promise<{ id: string; coaLockedAt: string | null }> {
  const reason = params?.reason?.trim();
  return apiFetch<{ id: string; coaLockedAt: string | null }>('/finance/coa/unlock', {
    method: 'POST',
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
}

export type SetupTaxControlAccountsResponse = {
  createdCount: number;
  createdAccountIds: string[];
};

export async function setupTaxControlAccounts(): Promise<SetupTaxControlAccountsResponse> {
  return apiFetch<SetupTaxControlAccountsResponse>('/finance/coa/setup-tax-control-accounts', {
    method: 'POST',
  });
}

export type CoaImportError = {
  row: number;
  column: string;
  message: string;
};

export type CoaImportFailureBody = {
  message: string;
  errors: CoaImportError[];
};

export type CoaImportSuccessResponse = {
  fileName: string;
  canonicalHash: string;
  rowCount: number;
  created: number;
  updated: number;
  warnings: string[];
};

export async function importCoa(file: File): Promise<CoaImportSuccessResponse> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<CoaImportSuccessResponse>('/finance/coa/import', {
    method: 'POST',
    body: fd,
  });
}

async function downloadBlob(path: string) {
  const res = await apiFetchRaw(path, { method: 'GET' });
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || 'download';
  return { blob, fileName };
}

export async function downloadCoaImportTemplate(format: 'csv' | 'xlsx') {
  return downloadBlob(`/finance/coa/import-template?format=${encodeURIComponent(format)}`);
}

export type CoaCleanupResponseDryRun = {
  canonicalHash: string | null;
  dryRun: true;
  wouldDeleteCount: number;
  wouldDelete: Array<{ accountCode: string; name: string; reason: string }>;
  blocked: Array<{ accountCode: string; name: string; referencedBy: string[] }>;
};

export type CoaCleanupResponseExecute = {
  canonicalHash: string | null;
  dryRun: false;
  deletedCount: number;
  blockedCount: number;
  blocked: Array<{ accountCode: string; name: string; referencedBy: string[] }>;
};

export async function cleanupNonCanonical(params: {
  canonicalHash?: string;
  dryRun?: boolean;
}): Promise<CoaCleanupResponseDryRun | CoaCleanupResponseExecute> {
  return apiFetch<CoaCleanupResponseDryRun | CoaCleanupResponseExecute>('/finance/coa/cleanup-non-canonical', {
    method: 'POST',
    body: JSON.stringify({
      canonicalHash: params.canonicalHash,
      dryRun: params.dryRun,
    }),
  });
}
