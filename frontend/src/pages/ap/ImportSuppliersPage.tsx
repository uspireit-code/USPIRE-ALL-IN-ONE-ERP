import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import {
  commitSupplierImport,
  downloadSupplierImportTemplate,
  previewSupplierImport,
  type SupplierImportPreviewResponse,
} from '../../services/ap';

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ImportSuppliersPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canImport = hasPermission(PERMISSIONS.AP.SUPPLIER.IMPORT);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SupplierImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canPreview = Boolean(file) && canImport && !busy;
  const canCommit = Boolean(preview?.rows?.length) && canImport && !busy;

  const onDownloadTemplate = async () => {
    setError(null);
    setCommitResult(null);
    try {
      const out = await downloadSupplierImportTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      const msg = e?.body?.message ?? e?.body?.error ?? 'Failed to download template';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const onPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setCommitResult(null);
    setPreview(null);
    try {
      const res = await previewSupplierImport(file);
      setPreview(res);
    } catch (e: any) {
      const msg = e?.body?.message ?? e?.body?.error ?? 'Preview failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async () => {
    if (!preview?.rows) return;
    setBusy(true);
    setError(null);
    setCommitResult(null);
    try {
      const res = await commitSupplierImport(preview.rows);
      setCommitResult(res);
    } catch (e: any) {
      const msg = e?.body?.message ?? e?.body?.error ?? 'Commit failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  const previewSummary = useMemo(() => {
    if (!preview) return undefined;
    const total = preview.totalRows ?? preview.rows?.length ?? 0;
    const invalid = (preview.rows ?? []).filter((r: any) => r?.isValid === false).length;
    const dup = (preview.rows ?? []).filter((r: any) => r?.isDuplicate === true).length;
    return { total, invalid, dup, errors: preview.errorCount ?? 0 };
  }, [preview]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Import Suppliers</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => navigate('/ap/suppliers')}>Back</button>
        </div>
      </div>

      {!canImport ? (
        <div style={{ color: 'crimson' }}>You do not have permission to import suppliers.</div>
      ) : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onDownloadTemplate} disabled={!canImport || busy}>
          Download CSV Template
        </button>
        <Link to="/ap/suppliers/new">Create Supplier Manually</Link>
      </div>

      <div style={{ marginTop: 12, maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={!canImport || busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            setCommitResult(null);
            setError(null);
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onPreview} disabled={!canPreview}>
            {busy ? 'Working...' : 'Preview'}
          </button>
          <button type="button" onClick={onCommit} disabled={!canCommit}>
            {busy ? 'Working...' : 'Commit (Skip duplicates)'}
          </button>
        </div>

        {error ? <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div> : null}

        {commitResult ? (
          <div style={{ color: '#0b5', fontSize: 13 }}>
            Imported. Created={commitResult.created ?? 0}, SkippedDuplicates={commitResult.skippedDuplicates ?? 0}, SkippedInvalid={commitResult.skippedInvalid ?? 0}
          </div>
        ) : null}

        {previewSummary ? (
          <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.75)' }}>
            Rows={previewSummary.total} · Invalid={previewSummary.invalid} · Duplicates={previewSummary.dup} · Errors={previewSummary.errors}
          </div>
        ) : null}

        {preview?.errors?.length ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600 }}>Validation Errors</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Row</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Field</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {preview.errors.slice(0, 200).map((e: any, idx: number) => (
                  <tr key={`${idx}-${e.rowNumber}-${e.message}`}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.rowNumber}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.field ?? ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {preview?.rows?.length ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600 }}>Preview Rows</div>
            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Row</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Tax Number</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Valid</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 500).map((r: any) => (
                  <tr key={r.rowNumber}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.rowNumber}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.name}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.taxNumber ?? ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.isValid ? 'YES' : 'NO'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.isDuplicate ? 'YES' : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
