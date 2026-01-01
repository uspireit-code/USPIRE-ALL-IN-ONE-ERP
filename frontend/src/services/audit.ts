import { apiFetch } from './api';

export type AuditOutcome = 'SUCCESS' | 'BLOCKED' | 'FAILED';

export type AuditEventType =
  | 'JOURNAL_POST'
  | 'PERIOD_CHECKLIST_COMPLETE'
  | 'PERIOD_CLOSE'
  | 'SOD_VIOLATION'
  | 'AP_POST'
  | 'AR_POST'
  | 'FA_CAPITALIZE'
  | 'FA_DEPRECIATION_RUN'
  | 'FA_DISPOSE'
  | 'BANK_RECONCILIATION_MATCH';

export type AuditEntityType =
  | 'JOURNAL_ENTRY'
  | 'ACCOUNTING_PERIOD'
  | 'ACCOUNTING_PERIOD_CHECKLIST_ITEM'
  | 'SUPPLIER_INVOICE'
  | 'CUSTOMER_INVOICE'
  | 'FIXED_ASSET'
  | 'FIXED_ASSET_DEPRECIATION_RUN'
  | 'BANK_RECONCILIATION_MATCH'
  | 'USER';

export type AuditEventRow = {
  id: string;
  tenantId: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  outcome: AuditOutcome;
  reason: string | null;
  permissionUsed: string | null;
  createdAt: string;
  user: { id: string; email: string };
};

export type AuditEventsResponse = {
  total: number;
  limit: number;
  offset: number;
  rows: AuditEventRow[];
};

export async function listAuditEvents(params: {
  from?: string;
  to?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  userId?: string;
  eventType?: AuditEventType;
  offset?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.entityType) q.set('entityType', params.entityType);
  if (params.entityId) q.set('entityId', params.entityId);
  if (params.userId) q.set('userId', params.userId);
  if (params.eventType) q.set('eventType', params.eventType);
  if (typeof params.offset === 'number') q.set('offset', String(params.offset));
  if (typeof params.limit === 'number') q.set('limit', String(params.limit));

  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<AuditEventsResponse>(`/audit/events${suffix}`, { method: 'GET' });
}
