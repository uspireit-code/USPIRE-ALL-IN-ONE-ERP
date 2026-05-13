import { apiFetch } from './api';

export type PagedResult<T> = {
  total: number;
  limit: number;
  offset: number;
  rows: T[];
};

export type GovernanceExceptionRegisterRow = {
  id: string;
  tenantId: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  outcome: string;
  reason: string | null;
  permissionUsed: string | null;
  requestId: string | null;
  createdAt: string;
  user?: { id: string; email: string } | null;
};

export type GovernanceOverrideSessionRegisterRow = Record<string, any> & {
  id: string;
  tenantId: string;
  overrideCode: string;
  entryPoint: string;
  status: string;
  requestedById: string;
  createdAt: string;
};

export type GovernanceEvidenceRegisterRow = {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256Hash: string;
  uploadedById: string;
  createdAt: string;
  governanceDomain: string | null;
  governanceActionType: string | null;
  evidenceCategory: string | null;
  retentionClassification: string | null;
  auditSensitivity: string | null;
  justificationText: string | null;
  uploadedBy?: { id: string; email: string } | null;
};

function buildQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function listGovernanceExceptionRegister(params?: {
  from?: string;
  to?: string;
  category?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  eventType?: string;
  outcome?: string;
  offset?: number;
  limit?: number;
}) {
  const qs = buildQuery(params ?? {});
  return apiFetch<PagedResult<GovernanceExceptionRegisterRow>>(
    `/governance/registers/exceptions${qs}`,
  );
}

export async function listGovernanceOverrideSessionsRegister(params?: {
  from?: string;
  to?: string;
  status?: string;
  overrideCode?: string;
  requestedById?: string;
  offset?: number;
  limit?: number;
}) {
  const qs = buildQuery(params ?? {});
  return apiFetch<PagedResult<GovernanceOverrideSessionRegisterRow>>(
    `/governance/registers/override-sessions${qs}`,
  );
}

export async function listGovernanceEvidenceRegister(params?: {
  from?: string;
  to?: string;
  entityType?: string;
  entityId?: string;
  governanceDomain?: string;
  governanceActionType?: string;
  evidenceCategory?: string;
  auditSensitivity?: string;
  offset?: number;
  limit?: number;
}) {
  const qs = buildQuery(params ?? {});
  return apiFetch<PagedResult<GovernanceEvidenceRegisterRow>>(
    `/governance/registers/evidence${qs}`,
  );
}
