import { useEffect, useMemo, useState } from 'react';
import type { ApiError } from '../services/api';
import {
  downloadAuditEvidence,
  listAuditEvidence,
  uploadAuditEvidence,
  type AuditEvidenceEntityType,
  type AuditEvidenceRow,
} from '../services/auditEvidence';
import { useAuth } from '../auth/AuthContext';
import { Card } from './Card';
import { Button } from './Button';
import { Alert } from './Alert';
import { DataTable } from './DataTable';

export function EvidencePanel(props: {
  entityType: AuditEvidenceEntityType;
  entityId: string;
  uploadsEnabled: boolean;
}) {
  const { hasPermission } = useAuth();
  const canUpload = hasPermission('AUDIT_EVIDENCE_UPLOAD');
  const canView = hasPermission('AUDIT_EVIDENCE_VIEW');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [rows, setRows] = useState<AuditEvidenceRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const errBody = (error as ApiError | any)?.body;

  const uploadsLockedReason = useMemo(() => {
    if (!props.uploadsEnabled) return 'Uploads are locked for this item.';
    if (!canUpload) return 'Missing permission: AUDIT_EVIDENCE_UPLOAD';
    return null;
  }, [canUpload, props.uploadsEnabled]);

  async function load() {
    if (!canView) return;
    if (!props.entityId) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await listAuditEvidence({ entityType: props.entityType, entityId: props.entityId });
      setRows(resp);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.entityType, props.entityId, canView]);

  async function onUpload() {
    if (!canUpload) return;
    if (!props.uploadsEnabled) return;
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      await uploadAuditEvidence({ entityType: props.entityType, entityId: props.entityId, file });
      setFile(null);
      const el = document.getElementById('evidence-file-input') as HTMLInputElement | null;
      if (el) el.value = '';
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(id: string) {
    if (!canView) return;
    setError(null);
    try {
      const out = await downloadAuditEvidence(id);
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Card
      title="Evidence & Attachments"
      subtitle="Upload supporting files and download evidence."
      actions={
        <Button onClick={load} disabled={loading || !canView} variant="secondary" size="sm">
          {loading ? 'Loading…' : 'Reload'}
        </Button>
      }
      style={{ marginTop: 16 }}
    >

      {!canView ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="info" title="No access">You do not have permission to view evidence.</Alert>
        </div>
      ) : null}

      {canView ? (
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="evidence-file-input"
            type="file"
            disabled={!canUpload || !props.uploadsEnabled || uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            onClick={onUpload}
            disabled={!canUpload || !props.uploadsEnabled || uploading || !file}
            title={uploadsLockedReason ?? undefined}
            variant="primary"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          {uploadsLockedReason ? <span style={{ fontSize: 12, color: '#666' }}>{uploadsLockedReason}</span> : null}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="error" title="Evidence error">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
          </Alert>
        </div>
      ) : null}

      {canView ? (
        <div style={{ marginTop: 12 }}>
          <DataTable>
            <DataTable.Head sticky>
              <tr>
                <DataTable.Th>File</DataTable.Th>
                <DataTable.Th>Uploaded By</DataTable.Th>
                <DataTable.Th>Uploaded At</DataTable.Th>
                <DataTable.Th>Size</DataTable.Th>
                <DataTable.Th align="right">Action</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.length === 0 ? <DataTable.Empty colSpan={5} title="No evidence uploaded." /> : null}
              {rows.map((r, idx) => (
                <DataTable.Row key={r.id} zebra index={idx}>
                  <DataTable.Td>{r.fileName}</DataTable.Td>
                  <DataTable.Td>{r.uploadedBy?.email ?? '-'}</DataTable.Td>
                  <DataTable.Td>{r.createdAt}</DataTable.Td>
                  <DataTable.Td>{r.size}</DataTable.Td>
                  <DataTable.Td align="right">
                    <Button onClick={() => onDownload(r.id)} disabled={!canView} variant="secondary" size="sm">
                      Download
                    </Button>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable>
        </div>
      ) : null}
    </Card>
  );
}
