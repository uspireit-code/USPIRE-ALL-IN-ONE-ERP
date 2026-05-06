import { apiFetch, apiFetchRaw } from './api';

export type CoaAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type NormalBalance = 'DEBIT' | 'CREDIT';

export type BudgetControlMode = 'NONE' | 'WARN' | 'BLOCK';

export type CoaLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'BLOCKED' | 'RETIRED';

export type CoaApprovalDisplayState = CoaLifecycleStatus | 'PENDING_APPROVAL' | 'REJECTED';

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
  ifrsMappingCode?: string | null;
  ifrsNodeId?: string | null;
  isBudgetRelevant: boolean;
  budgetControlMode: BudgetControlMode;
  status?: CoaLifecycleStatus;
  approvalState?: CoaApprovalDisplayState;
  latestRejectionReason?: string | null;
  latestRejectionAt?: string | null;
  latestRejectedBy?: { id: string; name: string; email: string } | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  blockedAt?: string | null;
  blockedById?: string | null;
  retiredAt?: string | null;
  retiredById?: string | null;
  createdAt: string;
  createdById: string | null;
  updatedAt: string;
};

export type CoaListResponse = {
  coaFrozen: boolean;
  coaLockedAt: string | null;
  structureFreeze?: {
    coaStructureFrozen: boolean;
    coaStructureFrozenAt: string | null;
    coaStructureFrozenByUserId: string | null;
    coaStructureFreezeEffectiveDate: string | null;
  };
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
  status?: CoaLifecycleStatus;
  approvalState?: CoaApprovalDisplayState;
  latestRejectionReason?: string | null;
  latestRejectionAt?: string | null;
  latestRejectedBy?: { id: string; name: string; email: string } | null;
  ifrsNodeId?: string | null;
  children: CoaTreeNode[];
};

export type CoaTreeResponse = {
  coaFrozen: boolean;
  coaLockedAt: string | null;
  structureFreeze?: {
    coaStructureFrozen: boolean;
    coaStructureFrozenAt: string | null;
    coaStructureFrozenByUserId: string | null;
    coaStructureFreezeEffectiveDate: string | null;
  };
  tree: CoaTreeNode[];
};

export type CoaHealthScoreBreakdown = {
  ifrsCompletenessScore: number;
  structuralIntegrityScore: number;
  namingQualityScore: number;
  lifecycleHygieneScore: number;
  governanceWorkflowScore: number;
};

export type CoaHealthResponse = {
  healthScore: number;
  scoreBreakdown: CoaHealthScoreBreakdown;
  summary: {
    totalAccountCount: number;
    postingAccountCount: number;
    statusCounts: Record<string, number>;
  };
  completeness: {
    postingAccountsMissingIfrsNodeCount: number;
  };
  naming: {
    duplicateCodeCount: number;
    duplicateNormalizedNameCount: number;
  };
  structural: {
    orphanAccountCount: number;
    invalidParentCount: number;
  };
  governance: {
    pendingApprovalRequestCount: number;
    pendingStructureChangeRequestCount: number;
    futureDatedStructuralChangeCount: number;
  };
  structureFreeze: {
    coaStructureFrozen: boolean;
    coaStructureFrozenAt: string | null;
    coaStructureFrozenByUserId: string | null;
    coaStructureFreezeEffectiveDate: string | null;
  };
  generatedAt: string;
};

export type CoaParentOption = {
  id: string;
  code: string;
  name: string;
};

export type IfrsMappingOption = {
  code: string;
  label: string;
  statementType: string;
  allowedAccountType: string;
};

export type IfrsNodeReferenceOption = {
  id: string;
  name: string;
  statement: string;
  fullPath: string;
  code: string;
  parentId?: string | null;
  level?: number | null;
};

export type IfrsStatement = 'BS' | 'PL' | 'CF';

export type IfrsNode = {
  id: string;
  code: string;
  name: string;
  statement: IfrsStatement;
  parentId: string | null;
  level: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type IfrsNodeTree = IfrsNode & { children: IfrsNodeTree[] };

export type IfrsNodesTreeResponse = Record<IfrsStatement, IfrsNodeTree[]>;

export async function listCoa(): Promise<CoaListResponse> {
  return apiFetch<CoaListResponse>('/finance/coa', { method: 'GET' });
}

export async function getCoaTree(params?: {
  asOfDate?: string;
}): Promise<CoaTreeResponse> {
  const q = new URLSearchParams();
  if (params?.asOfDate) q.set('asOfDate', params.asOfDate);
  const qs = q.toString();
  return apiFetch<CoaTreeResponse>(`/finance/coa/tree${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function getCoaTreeFiltered(params?: {
  status?: string;
  includePending?: boolean;
  includeRejected?: boolean;
  asOfDate?: string;
}): Promise<CoaTreeResponse> {
  void params;
  return getCoaTree({ asOfDate: params?.asOfDate });
}

export async function getOfficialCoaTree(params?: {
  asOfDate?: string;
}): Promise<CoaTreeResponse> {
  return getCoaTree({ asOfDate: params?.asOfDate });
}

export async function getCoaHealth(): Promise<CoaHealthResponse> {
  return apiFetch<CoaHealthResponse>('/finance/coa/health', { method: 'GET' });
}

export async function listCoaFiltered(params?: {
  status?: string;
  includePending?: boolean;
  includeRejected?: boolean;
}): Promise<CoaListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.includePending) q.set('includePending', 'true');
  if (params?.includeRejected) q.set('includeRejected', 'true');
  const qs = q.toString();
  return apiFetch<CoaListResponse>(`/finance/coa${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function listOfficialCoa(): Promise<CoaListResponse> {
  return listCoaFiltered({ status: 'ACTIVE' });
}

export async function listCoaSubmissions(): Promise<CoaListResponse> {
  return apiFetch<CoaListResponse>('/finance/coa/submissions', { method: 'GET' });
}

export async function getCoaParentOptions(): Promise<{ parents: CoaParentOption[] }> {
  return apiFetch<{ parents: CoaParentOption[] }>('/finance/coa/parent-options', { method: 'GET' });
}

export async function listMyCoaSubmissions(): Promise<CoaListResponse> {
  return listCoaFiltered({ status: 'DRAFT', includePending: true, includeRejected: true });
}

export async function structureFreezeCoa(params?: { effectiveDate?: string | Date }) {
  return apiFetch('/finance/coa/structure-freeze', {
    method: 'POST',
    body: JSON.stringify({ effectiveDate: params?.effectiveDate ?? undefined }),
  });
}

export async function structureUnfreezeCoa() {
  return apiFetch('/finance/coa/structure-unfreeze', { method: 'POST' });
}

export async function lockCoa() {
  return apiFetch('/finance/coa/lock', { method: 'POST' });
}

export async function unlockCoa(params?: { reason?: string }) {
  return apiFetch('/finance/coa/unlock', {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason ?? undefined }),
  });
}

export async function listIfrsMappings(params: { accountType: CoaAccountType }): Promise<IfrsMappingOption[]> {
  const q = new URLSearchParams();
  q.set('accountType', params.accountType);
  return apiFetch<IfrsMappingOption[]>(`/finance/ifrs-mappings?${q.toString()}`, { method: 'GET' });
}

export async function listIfrsNodeReference(): Promise<IfrsNodeReferenceOption[]> {
  return apiFetch<IfrsNodeReferenceOption[]>('/finance/settings/ifrs-nodes/reference', { method: 'GET' });
}

export async function listIfrsNodesTree(params?: { includeInactive?: boolean }): Promise<IfrsNodesTreeResponse> {
  const q = new URLSearchParams();
  if (params?.includeInactive) q.set('includeInactive', 'true');
  const qs = q.toString();
  return apiFetch<IfrsNodesTreeResponse>(`/finance/settings/ifrs-nodes${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createIfrsNode(payload: {
  name: string;
  statement: IfrsStatement;
  parentId?: string | null;
}): Promise<IfrsNode> {
  return apiFetch<IfrsNode>('/finance/settings/ifrs-nodes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateIfrsNode(
  id: string,
  payload: {
    name?: string;
    parentId?: string | null;
  },
): Promise<IfrsNode> {
  return apiFetch<IfrsNode>(`/finance/settings/ifrs-nodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deactivateIfrsNode(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/settings/ifrs-nodes/${id}`, {
    method: 'DELETE',
  });
}

export async function submitCoaAccount(id: string): Promise<{ ok: true; requestId?: string; alreadyPending?: boolean; message?: string; approvalStatus?: string }> {
  return apiFetch<{ ok: true; requestId?: string; alreadyPending?: boolean; message?: string; approvalStatus?: string }>(`/finance/coa/${id}/submit`, {
    method: 'POST',
  });
}

export type CoaBulkSubmitResult = {
  success: string[];
  failed: Array<{ id: string; message: string }>;
};

export async function bulkSubmitCoaAccounts(ids: string[]): Promise<CoaBulkSubmitResult> {
  return apiFetch<CoaBulkSubmitResult>('/finance/coa/bulk-submit', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function requestBlockCoaAccount(id: string, params?: { reason?: string }): Promise<{ ok: true; requestId: string; alreadyPending?: boolean }> {
  return apiFetch<{ ok: true; requestId: string; alreadyPending?: boolean }>(`/finance/coa/${id}/block`, {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason }),
  });
}

export async function requestActivateCoaAccount(id: string, params?: { reason?: string }): Promise<{ ok: true; requestId: string; alreadyPending?: boolean }> {
  return apiFetch<{ ok: true; requestId: string; alreadyPending?: boolean }>(`/finance/coa/${id}/activate`, {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason }),
  });
}

export async function requestRetireCoaAccount(id: string, params?: { reason?: string }): Promise<{ ok: true; requestId: string; alreadyPending?: boolean }> {
  return apiFetch<{ ok: true; requestId: string; alreadyPending?: boolean }>(`/finance/coa/${id}/retire`, {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason }),
  });
}

export type CoaApprovalRequestType = 'CREATE_ACCOUNT' | 'UPDATE_ACCOUNT' | 'STATUS_CHANGE';
export type CoaApprovalEntityType = 'ACCOUNT';

export type CoaApprovalQueueAccount = {
  id: string;
  code: string;
  name: string;
  accountType: CoaAccountType;
  parentCode: string;
  parentAccountId: string | null;
  normalBalance: NormalBalance;
  ifrsCode: string | null;
  fsMappingLevel1: string | null;
  fsMappingLevel2: string | null;
  isPosting: boolean;
  status: string;
};

export type CoaApprovalQueueItem = {
  id: string;
  requestType: CoaApprovalRequestType;
  entityType: CoaApprovalEntityType;
  entityId: string;
  payloadJson: any;
  requestedAt: string;
  requestedBy: { id: string; email: string | null; name: string | null };
  account?: CoaApprovalQueueAccount | null;
};

export async function listCoaApprovalQueue(): Promise<{ requests: CoaApprovalQueueItem[] }> {
  return apiFetch<{ requests: CoaApprovalQueueItem[] }>('/finance/coa/approvals/queue', { method: 'GET' });
}

export async function approveCoaRequest(requestId: string, params?: { comment?: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/approvals/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: params?.comment }),
  });
}

export type CoaBulkActionResult = {
  success: string[];
  failed: Array<{ id: string; message: string }>;
};

export async function bulkApproveCoaRequests(ids: string[], params?: { comment?: string }): Promise<CoaBulkActionResult> {
  return apiFetch<CoaBulkActionResult>('/finance/coa/bulk-approve', {
    method: 'POST',
    body: JSON.stringify({ ids, comment: params?.comment }),
  });
}

export async function rejectCoaRequest(requestId: string, params: { rejectionReason: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/approvals/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason: params.rejectionReason }),
  });
}

export async function bulkRejectCoaRequests(ids: string[], params?: { rejectionReason?: string }): Promise<CoaBulkActionResult> {
  return apiFetch<CoaBulkActionResult>('/finance/coa/bulk-reject', {
    method: 'POST',
    body: JSON.stringify({ ids, rejectionReason: params?.rejectionReason }),
  });
}

export async function getMyCoaSubmissionsTree(): Promise<CoaTreeResponse> {
  return getCoaTreeFiltered({ status: 'DRAFT', includePending: true, includeRejected: true });
}

export type CoaImportSuccessResponse = {
  fileName?: string;
  totalRows?: number;
  importedRows?: number;
  failedRows?: number;
  canonicalHash?: string | null;
  imported?: number;
  skipped?: number;
  submissionId?: string | null;
  batchId?: string | null;
  created?: number;
  updated?: number;
  warnings?: string[];
  autoSubmit?: boolean;
};

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
  ifrsCode?: string | null;
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
  ifrsCode?: string | null;
  isBudgetRelevant?: boolean;
  budgetControlMode?: BudgetControlMode;
}): Promise<CoaAccount> {
  const { id, ...body } = params;
  return apiFetch<CoaAccount>(`/finance/coa/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type CoaImportValidationRow = {
  rowNumber: number;
  accountCode: string;
  accountName: string;
  parentCode?: string | null;
  accountType: CoaAccountType | null;
  normalBalance: 'DEBIT' | 'CREDIT' | null;
  ifrsCode?: string | null;
  fsMappingLevel1?: string | null;
  fsMappingLevel2?: string | null;
  status: 'VALID' | 'ERROR';
  message?: string | null;
};

export type CoaImportValidationResponse = {
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: CoaImportValidationRow[];
};

export async function validateCoaImport(file: File): Promise<CoaImportValidationResponse> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<CoaImportValidationResponse>('/finance/coa/import/validate', {
    method: 'POST',
    body: fd,
  });
}

export type CoaImportCommitResponse = {
  imported: number;
  skipped: number;
  submissionId: string | null;
  batchId?: string | null;
};

export type CoaImportBatchStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type CoaImportBatch = {
  id: string;
  batchId: string;
  status: CoaImportBatchStatus;
  accountCount: number;
  sourceFileName?: string | null;
  createdAt: string;
  createdByUserId: string;
  submittedAt: string | null;
  submittedByUserId: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  rejectionReason: string | null;
};

export type CoaImportBatchReviewResponse = {
  batch: CoaImportBatch;
  tenant: { id: string; name: string };
  summary: {
    totalAccounts: number;
    postingAccounts: number;
    parentAccounts: number;
    rootCategoriesAffected: number;
    ifrsMappings: number;
    unmappedAccounts: number;
  };
  readiness: {
    validationStatus: 'READY' | 'INCOMPLETE' | 'ERROR';
    hasErrors: boolean;
    incompleteCount: number;
    errorCount: number;
    freezeLock: { coaFrozen: boolean; coaLockedAt: string | null };
  };
  accounts: Array<
    CoaImportBatchAccount & {
      parentLabel?: string | null;
      ifrsNode?: { id: string; name: string; statement: string } | null;
    }
  >;
};

export type CoaImportBatchAccountReadiness = 'READY' | 'INCOMPLETE' | 'ERROR';

export type CoaImportBatchAccountIssue = {
  field: string;
  message: string;
};

export type CoaImportBatchAccount = {
  id: string;
  code: string;
  name: string;
  type: CoaAccountType;
  description?: string | null;
  status: string;
  readiness: CoaImportBatchAccountReadiness;
  issues: CoaImportBatchAccountIssue[];
  message?: string;
  parentAccountId?: string | null;
  ifrsNodeId?: string | null;
  parentCode?: string | null;
  ifrsNode?: string | null;
};

export async function getDraftCoaImportBatch(): Promise<{ batch: CoaImportBatch | null }> {
  return apiFetch<{ batch: CoaImportBatch | null }>('/finance/coa/import-batches/draft', {
    method: 'GET',
  });
}

export async function listCoaImportBatchAccounts(batchId: string): Promise<{ batch: CoaImportBatch; accounts: CoaImportBatchAccount[] }> {
  return apiFetch<{ batch: CoaImportBatch; accounts: CoaImportBatchAccount[] }>(
    `/finance/coa/import-batches/${encodeURIComponent(batchId)}/accounts`,
    {
      method: 'GET',
    },
  );
}

export async function submitCoaImportBatch(batchId: string): Promise<{ ok: boolean; requestId: string; alreadyPending?: boolean }> {
  return apiFetch<{ ok: boolean; requestId: string; alreadyPending?: boolean }>(
    `/finance/coa/import-batches/${encodeURIComponent(batchId)}/submit`,
    {
      method: 'POST',
    },
  );
}

export async function cancelCoaImportBatch(batchId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/finance/coa/import-batches/${encodeURIComponent(batchId)}/cancel`, {
    method: 'POST',
  });
}

export async function reviewCoaImportBatch(batchId: string): Promise<CoaImportBatchReviewResponse> {
  return apiFetch<CoaImportBatchReviewResponse>(
    `/finance/coa/import-batches/${encodeURIComponent(batchId)}/review`,
    {
      method: 'GET',
    },
  );
}

export async function approveCoaImportBatch(batchId: string, params?: { comment?: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/import-batches/${encodeURIComponent(batchId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: params?.comment ?? undefined }),
  });
}

export async function rejectCoaImportBatch(batchId: string, params: { rejectionReason: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/import-batches/${encodeURIComponent(batchId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason: params.rejectionReason }),
  });
}

export async function commitCoaImport(dto: { sourceFileName?: string | null; rows: CoaImportValidationRow[] }): Promise<CoaImportCommitResponse> {
  return apiFetch<CoaImportCommitResponse>('/finance/coa/import/commit', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function importCoa(file: File): Promise<CoaImportSuccessResponse> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return apiFetch<CoaImportSuccessResponse>('/finance/coa/import', {
    method: 'POST',
    body: fd,
  });
}

export type SetupTaxControlAccountsResponse = {
  ok: boolean;
  createdCount?: number;
  updatedCount?: number;
  message?: string;
};

export async function setupTaxControlAccounts(): Promise<SetupTaxControlAccountsResponse> {
  return apiFetch<SetupTaxControlAccountsResponse>('/finance/coa/setup-tax-control-accounts', {
    method: 'POST',
  });
}

export type CoaReclassification = {
  id: string;
  tenantId: string;
  accountId: string;
  newParentAccountId?: string | null;
  newIfrsMappingCode?: string | null;
  newFsMappingLevel1?: string | null;
  newFsMappingLevel2?: string | null;
  effectiveStartDate: string;
  reason?: string | null;
  requestedById?: string | null;
  requestedAt?: string | null;
  status: string;
};

export async function listCoaReclassifications(): Promise<{ reclassifications: CoaReclassification[] }> {
  return apiFetch<{ reclassifications: CoaReclassification[] }>('/finance/coa/reclassifications', {
    method: 'GET',
  });
}

export async function createCoaReclassification(payload: {
  accountId: string;
  newParentAccountId?: string | null;
  newIfrsMappingCode?: string | null;
  newFsMappingLevel1?: string | null;
  newFsMappingLevel2?: string | null;
  effectiveStartDate: string;
  reason?: string | null;
}): Promise<CoaReclassification> {
  return apiFetch<CoaReclassification>('/finance/coa/reclassifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitCoaReclassification(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/reclassifications/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
  });
}

export async function approveCoaReclassification(id: string, params?: { comment?: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/reclassifications/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: params?.comment ?? undefined }),
  });
}

export async function rejectCoaReclassification(id: string, params?: { rejectionReason?: string }): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/finance/coa/reclassifications/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason: params?.rejectionReason ?? undefined }),
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

export async function downloadCoaIndustryImportTemplate(industry: string) {
  return downloadBlob(
    `/finance/coa/import-template/industry/${encodeURIComponent(industry)}?format=xlsx`,
  );
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
