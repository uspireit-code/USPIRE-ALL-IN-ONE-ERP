import { apiFetch } from './api';

export type AdminUserLookup = {
  id: string;
  fullName: string;
  email: string;
  roleName?: string | null;
  isActive: boolean;
};

export type DelegationScope = 'APPROVE' | 'POST' | 'BOTH';

export type DelegationRow = {
  id: string;
  delegatorUserId: string;
  delegateUserId: string;
  startsAt: string;
  expiresAt: string;
  revokedAt: string | null;
  scope: DelegationScope;
  reason: string | null;
  createdAt: string;
  createdByUserId: string;
  active: boolean;
};

export async function listAdminUsers() {
  return apiFetch<{ users: AdminUserLookup[] }>('/users/admin/users', { method: 'GET' });
}

export async function listDelegations(params?: {
  activeOnly?: boolean;
  includeExpired?: boolean;
  delegatorUserId?: string;
  delegateUserId?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.activeOnly !== undefined) sp.set('activeOnly', String(params.activeOnly));
  if (params?.includeExpired !== undefined) sp.set('includeExpired', String(params.includeExpired));
  if (params?.delegatorUserId) sp.set('delegatorUserId', params.delegatorUserId);
  if (params?.delegateUserId) sp.set('delegateUserId', params.delegateUserId);
  const qs = sp.toString();
  return apiFetch<{ delegations: DelegationRow[] }>(`/admin/delegations${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createDelegation(params: {
  delegatorUserId: string;
  delegateUserId: string;
  scope: DelegationScope;
  startsAt: string;
  expiresAt: string;
  reason?: string;
}) {
  return apiFetch<{ delegation: DelegationRow }>('/admin/delegations', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function revokeDelegation(delegationId: string) {
  const id = String(delegationId ?? '').trim();
  return apiFetch<{ ok: true; delegationId: string; revokedAt: string }>(`/admin/delegations/${id}/revoke`, {
    method: 'POST',
  });
}
