import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { PageLayout } from '../../../components/PageLayout';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  downloadJournalUploadCsvTemplate,
  downloadJournalUploadXlsxTemplate,
  uploadJournals,
  type JournalUploadError,
  type JournalUploadFailureBody,
} from '../../../services/glJournalUpload.ts';

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

function toErrorsCsv(errors: JournalUploadError[]) {
  const headers = ['journalKey', 'sheet', 'rowNumber', 'field', 'message'];
  const esc = (v: any) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const rows = errors.map((e) => [e.journalKey ?? '', e.sheet ?? '', e.rowNumber ?? '', e.field ?? '', e.message ?? ''].map(esc).join(','));
  return [headers.join(','), ...rows].join('\n') + '\n';
}

export function JournalUploadPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canUpload = hasPermission('FINANCE_GL_CREATE');

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | { fileName: string; journalsCreated: number; items: Array<{ journalKey: string; journalId: string }> }>(null);
  const [uploadErrors, setUploadErrors] = useState<JournalUploadError[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = Boolean(file) && !busy;

  const acceptExt = ['.csv', '.xlsx'];
  const maxBytes = 25 * 1024 * 1024;

  const resetStateForNewFile = () => {
    setSuccess(null);
    setUploadErrors([]);
    setError(null);
  };

  const selectFile = (f: File | null) => {
    resetStateForNewFile();
    if (!f) {
      setFile(null);
      return;
    }

    const name = f.name || '';
    const lower = name.toLowerCase();
    const okExt = acceptExt.some((ext) => lower.endsWith(ext));
    if (!okExt) {
      setFile(null);
      setError('Unsupported file type. Please upload a .csv or .xlsx file.');
      return;
    }
    if (f.size > maxBytes) {
      setFile(null);
      setError('File is too large. Please upload a file smaller than 25 MB.');
      return;
    }

    setFile(f);
  };

  const errorSummary = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const e of uploadErrors) {
      const k = e.journalKey || '(no journalKey)';
      byKey.set(k, (byKey.get(k) ?? 0) + 1);
    }
    return Array.from(byKey.entries()).sort((a, b) => b[1] - a[1]);
  }, [uploadErrors]);

  const onDownloadCsv = async () => {
    setError(null);
    try {
      const out = await downloadJournalUploadCsvTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to download CSV template'));
    }
  };

  const onDownloadXlsx = async () => {
    setError(null);
    try {
      const out = await downloadJournalUploadXlsxTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to download XLSX template'));
    }
  };

  const onUpload = async () => {
    if (!file) return;

    setBusy(true);
    setError(null);
    setSuccess(null);
    setUploadErrors([]);

    try {
      const res = await uploadJournals(file);
      setSuccess(res);
    } catch (e: any) {
      const body = (e as any)?.body as JournalUploadFailureBody | any;
      if (body && Array.isArray(body.errors)) {
        setUploadErrors(body.errors as JournalUploadError[]);
        setError(body.error || 'Upload rejected');
      } else {
        setError(getApiErrorMessage(e, 'Upload failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const onDownloadErrorsCsv = () => {
    const csv = toErrorsCsv(uploadErrors);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'journal_upload_errors.csv');
  };

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canUpload) {
    return (
      <PageLayout title="Journal Upload" description="Upload a CSV or Excel file. Entire upload is rejected if any validation fails.">
        <Alert tone="error" title="Access Denied">
          You do not have permission to upload journals.
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Journal Upload"
      description="Upload a CSV or Excel file. Entire upload is rejected if any validation fails."
      actions={
        <Link
          to="/finance/gl/journals"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: tokens.radius.sm,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 650,
            color: tokens.colors.text.primary,
            textDecoration: 'none',
            border: '1px solid transparent',
            background: 'transparent',
            transition: `background-color ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}, transform ${tokens.transition.normal}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.surface.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Back to Journals
        </Link>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, maxWidth: 980 }}>
        <Card
          title="Step 1 — Download a template"
          subtitle="Use one of the official templates to ensure the required columns/sheets are present."
          actions={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="secondary" disabled={busy} onClick={onDownloadCsv}>
                Download CSV
              </Button>
              <Button variant="secondary" disabled={busy} onClick={onDownloadXlsx}>
                Download Excel
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            If any row fails validation, the entire upload is rejected and you’ll get a detailed error list.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            LegalEntityCode is mandatory on every journal line. DepartmentCode depends on the Natural Account (required for P&L, optional for balance sheet, forbidden for control accounts).
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
            ProjectCode and FundCode are optional. If provided, FundCode requires ProjectCode.
          </div>
        </Card>

        <Card title="Step 2 — Upload completed file" subtitle="CSV (.csv) or Excel (.xlsx). Maximum size 25 MB.">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptExt.join(',')}
              disabled={busy}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                selectFile(f);
              }}
            />

            <div
              role="button"
              tabIndex={0}
              aria-disabled={busy}
              onClick={() => {
                if (busy) return;
                fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (busy) return;
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (busy) return;
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                if (busy) return;
                const f = e.dataTransfer.files?.[0] ?? null;
                selectFile(f);
              }}
              style={{
                padding: tokens.spacing.x3,
                borderRadius: tokens.radius.lg,
                border: `1px dashed ${dragOver ? tokens.colors.border.strong : tokens.colors.border.default}`,
                background: dragOver ? tokens.colors.surface.subtle : tokens.colors.white,
                transition: `background-color ${tokens.transition.normal}, border-color ${tokens.transition.normal}`,
                cursor: busy ? 'not-allowed' : 'pointer',
                outline: 'none',
              }}
            >
              <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>Drag and drop your file here</div>
              <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>or click to browse</div>
              {file ? (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
                    Selected: <span style={{ color: tokens.colors.text.primary, fontWeight: 650 }}>{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setFile(null);
                      resetStateForNewFile();
                    }}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" disabled={!canSubmit} onClick={onUpload}>
                {busy ? 'Uploading…' : 'Upload'}
              </Button>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Accepted: {acceptExt.join(', ')} · Max: 25 MB</div>
            </div>
          </div>
        </Card>
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone={uploadErrors.length > 0 ? 'warning' : 'error'} title={uploadErrors.length > 0 ? 'Validation Failed' : 'Error'}>
            {error}
          </Alert>
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="success" title="Upload Successful">
            <div>File: {success.fileName}</div>
            <div>Journals created: {success.journalsCreated}</div>
          </Alert>
        </div>
      ) : null}

      {success?.items?.length ? (
        <div style={{ marginTop: 12 }}>
          <Card title="Created journals" subtitle="Links to the journals created from this upload.">
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>journalKey</DataTable.Th>
                  <DataTable.Th>journalId</DataTable.Th>
                  <DataTable.Th align="right">Actions</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {success.items.map((it, idx) => (
                  <DataTable.Row key={it.journalId} zebra index={idx}>
                    <DataTable.Td>{it.journalKey}</DataTable.Td>
                    <DataTable.Td>{it.journalId}</DataTable.Td>
                    <DataTable.Td align="right">
                      <Link to={`/finance/gl/journals/${it.journalId}`}>View</Link>
                    </DataTable.Td>
                  </DataTable.Row>
                ))}
              </DataTable.Body>
            </DataTable>
          </Card>
        </div>
      ) : null}

      {uploadErrors.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <Card
            title={`Errors (${uploadErrors.length})`}
            subtitle="Fix the issues below and upload again."
            actions={
              <Button variant="secondary" disabled={busy} onClick={onDownloadErrorsCsv}>
                Download Errors CSV
              </Button>
            }
          >
            <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
              Top affected journals:
              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {errorSummary.slice(0, 6).map(([k, count]) => (
                  <div
                    key={k}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: tokens.colors.surface.subtle,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      fontSize: 12,
                      color: tokens.colors.text.primary,
                    }}
                  >
                    {k}: {count}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <DataTable>
                <DataTable.Head>
                  <tr>
                    <DataTable.Th>journalKey</DataTable.Th>
                    <DataTable.Th>sheet</DataTable.Th>
                    <DataTable.Th>row</DataTable.Th>
                    <DataTable.Th>field</DataTable.Th>
                    <DataTable.Th>message</DataTable.Th>
                  </tr>
                </DataTable.Head>
                <DataTable.Body>
                  {uploadErrors.slice(0, 250).map((e, idx) => (
                    <DataTable.Row key={`${idx}-${e.message}`} zebra index={idx}>
                      <DataTable.Td>{e.journalKey ?? ''}</DataTable.Td>
                      <DataTable.Td>{e.sheet ?? ''}</DataTable.Td>
                      <DataTable.Td>{e.rowNumber ?? ''}</DataTable.Td>
                      <DataTable.Td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                        {e.field ?? ''}
                      </DataTable.Td>
                      <DataTable.Td>{e.message}</DataTable.Td>
                    </DataTable.Row>
                  ))}
                </DataTable.Body>
              </DataTable>
            </div>

            {uploadErrors.length > 250 ? (
              <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>
                Showing first 250 errors. Download CSV for the full list.
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </PageLayout>
  );
}
