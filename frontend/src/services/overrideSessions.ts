import { apiFetch } from './api';

export type OverrideSessionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'REVOKED';

export type GovernanceOverrideSessionRow = {
  id: string;
  tenantId: string;

  overrideCode: string;
  entryPoint: string;
  status: OverrideSessionStatus;

  reason: string;
  justification: string;

  escalationType: string | null;
  escalationReason: string | null;

  entityType: string | null;
  entityId: string | null;

  requestedById: string;
  requestedAt?: string | null;

  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;

  revokedById: string | null;
  revokedAt: string | null;

  executedAt: string | null;
  expiresAt: string;

  createdAt: string;
  updatedAt?: string | null;
};

export async function createOverrideSession(params: {
  overrideCode: string;
  entryPoint: string;
  reason: string;
  justification: string;
  expiresAt: string;
  escalationType?: string | null;
  escalationReason?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return apiFetch<GovernanceOverrideSessionRow>('/governance/override-sessions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listOverrideSessions(params?: {
  status?: string;
  overrideCode?: string;
  requestedById?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.overrideCode) sp.set('overrideCode', params.overrideCode);
  if (params?.requestedById) sp.set('requestedById', params.requestedById);
  const qs = sp.toString();

  return apiFetch<GovernanceOverrideSessionRow[]>(
    `/governance/override-sessions${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export async function getOverrideSession(sessionId: string) {
  const id = String(sessionId ?? '').trim();
  return apiFetch<GovernanceOverrideSessionRow>(`/governance/override-sessions/${id}`, {
    method: 'GET',
  });
}

export async function approveOverrideSession(sessionId: string) {
  const id = String(sessionId ?? '').trim();
  return apiFetch<GovernanceOverrideSessionRow>(
    `/governance/override-sessions/${id}/approve`,
    { method: 'POST' },
  );
}

export async function rejectOverrideSession(sessionId: string) {
  const id = String(sessionId ?? '').trim();
  return apiFetch<GovernanceOverrideSessionRow>(
    `/governance/override-sessions/${id}/reject`,
    { method: 'POST' },
  );
}

export async function revokeOverrideSession(sessionId: string) {
  const id = String(sessionId ?? '').trim();
  return apiFetch<GovernanceOverrideSessionRow>(
    `/governance/override-sessions/${id}/revoke`,
    { method: 'POST' },
  );
}
