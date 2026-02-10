import { apiFetch, apiFetchRaw } from './api';

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
  const res = await apiFetchRaw(`/audit/evidence/${evidenceId}/download`, { method: 'GET' });

  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  const fileName = match?.[1] || `evidence_${evidenceId}`;
  return { blob, fileName };
}
