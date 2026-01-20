import { apiFetch } from './api';

export type ImprestRiskRating = 'LOW' | 'MEDIUM' | 'HIGH';

export type ImprestTypePolicy = {
  id: string;
  tenantId: string;
  name: string;
  defaultFloatLimit: string;
  settlementDays: number;
  receiptRule: string;
  receiptThresholdAmount?: string | null;
  approvalStrength: string;
  defaultRiskRating: ImprestRiskRating;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listImprestTypePolicies() {
  return apiFetch<ImprestTypePolicy[]>('/imprest/type-policies', { method: 'GET' });
}

export async function createImprestTypePolicy(params: {
  name: string;
  defaultFloatLimit: string;
  settlementDays: number;
  receiptRule: string;
  receiptThresholdAmount?: string;
  approvalStrength: string;
  defaultRiskRating: ImprestRiskRating;
  effectiveFrom: string;
  effectiveTo?: string;
}) {
  return apiFetch<ImprestTypePolicy>('/imprest/type-policies', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateImprestTypePolicy(
  id: string,
  params: Partial<{
    name: string;
    defaultFloatLimit: string;
    settlementDays: number;
    receiptRule: string;
    receiptThresholdAmount: string | null;
    approvalStrength: string;
    defaultRiskRating: ImprestRiskRating;
    effectiveFrom: string;
    effectiveTo: string | null;
    isActive: boolean;
  }>,
) {
  return apiFetch<ImprestTypePolicy>(`/imprest/type-policies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export type ImprestFacility = {
  id: string;
  tenantId: string;
  reference?: string | null;
  typePolicyId: string;
  custodianUserId: string;
  entityId: string;
  departmentId: string;
  projectId?: string | null;
  fundId?: string | null;
  currency: string;
  approvedFloatLimit: string;
  settlementDays: number;
  fundingSourceType: 'BANK' | 'CASH' | 'MOBILE_MONEY';
  bankAccountId?: string | null;
  riskRating: ImprestRiskRating;
  controlGlAccountId: string;
  validFrom: string;
  validTo: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listImprestFacilities() {
  return apiFetch<ImprestFacility[]>('/imprest/facilities', { method: 'GET' });
}

export async function createImprestFacility(params: {
  typePolicyId: string;
  custodianUserId: string;
  entityId: string;
  departmentId: string;
  projectId?: string;
  fundId?: string;
  currency: string;
  approvedFloatLimit: string;
  settlementDays: number;
  fundingSourceType: 'BANK' | 'CASH' | 'MOBILE_MONEY';
  bankAccountId?: string;
  riskRating: ImprestRiskRating;
  controlGlAccountId: string;
  validFrom: string;
  validTo: string;
}) {
  return apiFetch<ImprestFacility>('/imprest/facilities', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateImprestFacility(
  id: string,
  params: Partial<{
    typePolicyId: string;
    custodianUserId: string;
    entityId: string;
    departmentId: string;
    projectId: string | null;
    fundId: string | null;
    currency: string;
    approvedFloatLimit: string;
    settlementDays: number;
    fundingSourceType: 'BANK' | 'CASH' | 'MOBILE_MONEY';
    bankAccountId: string | null;
    riskRating: ImprestRiskRating;
    controlGlAccountId: string;
    validFrom: string;
    validTo: string;
    status: string;
  }>,
) {
  return apiFetch<ImprestFacility>(`/imprest/facilities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export type ImprestEvidenceType =
  | 'REQUEST_SUPPORTING_DOC'
  | 'FUNDING_PROOF'
  | 'RECEIPT_BUNDLE'
  | 'CASH_RETURN_PROOF'
  | 'OTHER';

export type ImprestCaseTransition = {
  id: string;
  caseId: string;
  fromState: string;
  toState: string;
  actorUserId: string;
  notes?: string | null;
  createdAt: string;
};

export type ImprestCaseEvidenceLink = {
  id: string;
  caseId: string;
  evidenceId: string;
  type: ImprestEvidenceType;
  createdAt: string;
  evidence?: any;
};

export type ImprestSettlementLineType = 'EXPENSE' | 'CASH_RETURN';

export type ImprestSettlementLine = {
  id: string;
  tenantId: string;
  caseId: string;
  type: ImprestSettlementLineType;
  glAccountId?: string | null;
  description: string;
  amount: string;
  spentDate: string;
  createdById: string;
  createdAt: string;
};

export type ImprestSettlementSummary = {
  caseId: string;
  state: string;
  currency: string;
  issuedAmount: string;
  expensesTotal: string;
  cashReturnedTotal: string;
  totalAccounted: string;
  difference: string;
  linesCount: number;
};

export type ImprestCase = {
  id: string;
  tenantId: string;
  reference: string;
  facilityId: string;
  purpose: string;
  justification: string;
  periodFrom: string;
  periodTo: string;
  expectedSettlementDate: string;
  requestedAmount: string;
  currency: string;
  state: string;
  createdById?: string | null;
  reviewedById?: string | null;
  approvedById?: string | null;
  issuedById?: string | null;
  issuedJournalId?: string | null;
  settlementJournalId?: string | null;
  createdAt: string;
  updatedAt: string;
  transitions?: ImprestCaseTransition[];
  evidence?: ImprestCaseEvidenceLink[];
  settlementLines?: ImprestSettlementLine[];
  facility?: any;
};

export async function listImprestCases() {
  return apiFetch<ImprestCase[]>('/imprest/cases', { method: 'GET' });
}

export async function getImprestCase(id: string) {
  return apiFetch<ImprestCase>(`/imprest/cases/${encodeURIComponent(id)}`, { method: 'GET' });
}

export async function createImprestCase(params: {
  facilityId: string;
  purpose: string;
  justification: string;
  periodFrom: string;
  periodTo: string;
  expectedSettlementDate: string;
  requestedAmount: string;
  currency: string;
}) {
  return apiFetch<ImprestCase>('/imprest/cases', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitImprestCase(id: string, params?: { notes?: string }) {
  return apiFetch<ImprestCase>(`/imprest/cases/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function reviewImprestCase(id: string, params?: { notes?: string }) {
  return apiFetch<ImprestCase>(`/imprest/cases/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function approveImprestCase(id: string, params?: { notes?: string }) {
  return apiFetch<ImprestCase>(`/imprest/cases/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function rejectImprestCase(id: string, params: { reason: string }) {
  return apiFetch<ImprestCase>(`/imprest/cases/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function linkImprestEvidence(id: string, params: { evidenceId: string; type: ImprestEvidenceType }) {
  return apiFetch<any>(`/imprest/cases/${encodeURIComponent(id)}/evidence`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function issueImprestCase(id: string, params: { issueDate: string; notes?: string }) {
  return apiFetch<any>(`/imprest/cases/${encodeURIComponent(id)}/issue`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function settleImprestCase(id: string) {
  return apiFetch<any>(`/imprest/cases/${encodeURIComponent(id)}/settle`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getImprestSettlementSummary(caseId: string) {
  return apiFetch<ImprestSettlementSummary>(
    `/imprest/cases/${encodeURIComponent(caseId)}/settlement-summary`,
    { method: 'GET' },
  );
}

export async function createImprestSettlementLine(
  caseId: string,
  params: { type: ImprestSettlementLineType; glAccountId?: string; description: string; amount: string; spentDate: string },
) {
  return apiFetch<ImprestSettlementLine>(`/imprest/cases/${encodeURIComponent(caseId)}/settlement-lines`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateImprestSettlementLine(
  id: string,
  params: Partial<{ type: ImprestSettlementLineType; glAccountId: string | null; description: string; amount: string; spentDate: string }>,
) {
  return apiFetch<ImprestSettlementLine>(`/imprest/settlement-lines/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function deleteImprestSettlementLine(id: string) {
  return apiFetch<{ ok: true }>(`/imprest/settlement-lines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
