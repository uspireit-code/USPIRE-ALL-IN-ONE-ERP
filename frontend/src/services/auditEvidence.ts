import { apiFetch } from './api';

export type AuditEvidenceEntityType =
  | 'JOURNAL_ENTRY'
  | 'ACCOUNTING_PERIOD'
  | 'ACCOUNTING_PERIOD_CHECKLIST_ITEM'
  | 'SUPPLIER_INVOICE'
  | 'CUSTOMER_INVOICE'
  | 'FIXED_ASSET'
  | 'FIXED_ASSET_DEPRECIATION_RUN'
  | 'BANK_RECONCILIATION_MATCH'
  | 'IMPREST_CASE'
  | 'USER';

export type AuditEvidenceRow = {
  id: string;
  tenantId: string;
  entityType: AuditEvidenceEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256Hash: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy?: { id: string; email: string };
};

export async function listAuditEvidence(params: { entityType: AuditEvidenceEntityType; entityId: string }) {
  const q = new URLSearchParams({ entityType: params.entityType, entityId: params.entityId });
  return apiFetch<AuditEvidenceRow[]>(`/audit/evidence?${q.toString()}`, { method: 'GET' });
}

export async function uploadAuditEvidence(params: {
  entityType: AuditEvidenceEntityType;
  entityId: string;
  file: File;
}) {
  const fd = new FormData();
  fd.append('entityType', params.entityType);
  fd.append('entityId', params.entityId);
  fd.append('file', params.file, params.file.name);

  return apiFetch<AuditEvidenceRow>('/audit/evidence', {
    method: 'POST',
    body: fd,
  });
}

export async function downloadAuditEvidence(evidenceId: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const accessToken = localStorage.getItem('accessToken') ?? '';
  const tenantId = localStorage.getItem('tenantId') ?? '';

  const headers = new Headers();
  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${baseUrl}/audit/evidence/${evidenceId}/download`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw { status: res.status, body: text };
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || `evidence_${evidenceId}`;
  return { blob, fileName };
}
