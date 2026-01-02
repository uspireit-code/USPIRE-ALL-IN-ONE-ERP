import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { CustomerInvoice } from '../../services/ar';
import {
  bulkPostInvoices,
  downloadInvoicesImportCsvTemplate,
  downloadInvoicesImportXlsxTemplate,
  importInvoices,
  listInvoices,
  previewInvoicesImport,
  type InvoicesImportPreviewRow,
  type InvoicesImportPreviewResponse,
  type InvoicesImportResponse,
} from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';
import { formatMoney } from '../../money';

export function InvoicesListPage() {
  const { hasPermission } = useAuth();
  const canCreateInvoice = hasPermission('AR_INVOICE_CREATE');
  const canImportInvoices = hasPermission('AR_INVOICE_CREATE');
  const canPostInvoices = hasPermission('AR_INVOICE_POST');

  const [rows, setRows] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkPostBusy, setBulkPostBusy] = useState(false);
  const [bulkPostError, setBulkPostError] = useState<string | null>(null);
  const [bulkPostResult, setBulkPostResult] = useState<{
    postedCount: number;
    failedCount: number;
    postedInvoiceIds: string[];
    failed: Array<{ invoiceId: string; reason: string }>;
  } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoicesImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<InvoicesImportResponse | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const acceptExt = ['.csv', '.xlsx'];
  const maxBytes = 10 * 1024 * 1024;

  const load = () => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listInvoices()
      .then((res) => {
        if (!mounted) return;
        setRows(res.items ?? []);
        setSelectedIds({});
        setBulkPostResult(null);
        setBulkPostError(null);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load invoices'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  };

  const groupedPreview = useMemo(() => {
    if (!preview) return [] as Array<{ invoiceRef: string; rows: InvoicesImportPreviewRow[] }>;
    const map = new Map<string, InvoicesImportPreviewRow[]>();
    for (const r of preview.rows ?? []) {
      const key = String((r as any).invoiceRef ?? '').trim() || '(missing invoiceRef)';
      const prev = map.get(key) ?? [];
      prev.push(r);
      map.set(key, prev);
    }
    return [...map.entries()].map(([invoiceRef, rows]) => ({ invoiceRef, rows }));
  }, [preview]);

  useEffect(() => {
    return load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetImportState = () => {
    setImportFile(null);
    setPreview(null);
    setImportResult(null);
    setImportError(null);
    setImportBusy(false);
    setImportSubmitting(false);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onOpenImport = () => {
    if (!canImportInvoices) return;
    resetImportState();
    setImportOpen(true);
  };

  const onCloseImport = () => setImportOpen(false);

  const selectImportFile = (f: File | null) => {
    setImportError(null);
    setImportResult(null);
    setPreview(null);

    if (!f) {
      setImportFile(null);
      return;
    }

    const name = f.name || '';
    const lower = name.toLowerCase();
    const okExt = acceptExt.some((ext) => lower.endsWith(ext));
    if (!okExt) {
      setImportFile(null);
      setImportError('Unsupported file type. Please upload a .csv or .xlsx file.');
      return;
    }
    if (f.size > maxBytes) {
      setImportFile(null);
      setImportError('File is too large. Please upload a file smaller than 10 MB.');
      return;
    }

    setImportFile(f);
  };

  const onDownloadCsv = async () => {
    setImportError(null);
    try {
      const out = await downloadInvoicesImportCsvTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Failed to download CSV template'));
    }
  };

  const onDownloadXlsx = async () => {
    setImportError(null);
    try {
      const out = await downloadInvoicesImportXlsxTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Failed to download XLSX template'));
    }
  };

  const onPreview = async () => {
    if (!importFile) return;
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await previewInvoicesImport(importFile);
      setPreview(res);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Preview failed'));
    } finally {
      setImportBusy(false);
    }
  };

  const onImport = async () => {
    if (!importFile) return;
    if (!preview?.importId) {
      setImportError('Please preview the file first.');
      return;
    }
    setImportSubmitting(true);
    setImportError(null);
    try {
      const res = await importInvoices(importFile, { importId: preview.importId });
      setImportResult(res);
      load();

      // Close + reset on success to prevent duplicate submission
      resetImportState();
      setImportOpen(false);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Import failed'));
    } finally {
      setImportSubmitting(false);
    }
  };

  const content = useMemo(() => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    const draftRows = rows.filter((r) => r.status === 'DRAFT');
    const selectedDraftIds = draftRows.filter((r) => selectedIds[r.id]).map((r) => r.id);
    const selectedCount = selectedDraftIds.length;

    return (
      <div>
        {canPostInvoices ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={bulkPostBusy || selectedCount === 0}
              onClick={async () => {
                if (selectedCount === 0) return;
                const ok = window.confirm(`You are about to post ${selectedCount} invoice(s). This action cannot be undone.`);
                if (!ok) return;

                setBulkPostBusy(true);
                setBulkPostError(null);
                setBulkPostResult(null);
                try {
                  const res = await bulkPostInvoices({ invoiceIds: selectedDraftIds });
                  setBulkPostResult(res);
                  load();
                } catch (e: any) {
                  setBulkPostError(getApiErrorMessage(e, 'Bulk post failed'));
                } finally {
                  setBulkPostBusy(false);
                }
              }}
            >
              {bulkPostBusy ? 'Posting…' : `Post Selected (${selectedCount})`}
            </button>

            {bulkPostError ? <div style={{ color: 'crimson' }}>{bulkPostError}</div> : null}
            {bulkPostResult ? (
              <div style={{ fontSize: 13, color: '#444' }}>
                Bulk Post Result: {bulkPostResult.postedCount} posted, {bulkPostResult.failedCount} failed
              </div>
            ) : null}
          </div>
        ) : null}

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {canPostInvoices ? <th style={{ width: 36, borderBottom: '1px solid #ddd', padding: 8 }} /> : null}
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const canSelect = canPostInvoices && inv.status === 'DRAFT';
              return (
                <tr key={inv.id}>
                  {canPostInvoices ? (
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <input
                        type="checkbox"
                        disabled={!canSelect || bulkPostBusy}
                        checked={Boolean(selectedIds[inv.id])}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => ({ ...prev, [inv.id]: checked }));
                        }}
                      />
                    </td>
                  ) : null}
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.customer?.name ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <Link to={`/finance/ar/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(inv.totalAmount, inv.currency)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {bulkPostResult?.failed?.length ? (
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {bulkPostResult.failed.map((f) => (
                  <tr key={f.invoiceId}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.invoiceId}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', color: 'crimson' }}>{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }, [bulkPostBusy, bulkPostError, bulkPostResult, canPostInvoices, error, loading, rows, selectedIds]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer Invoices</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canImportInvoices ? (
            <button type="button" onClick={onOpenImport}>
              Import Invoices
            </button>
          ) : null}
          {canCreateInvoice ? <Link to="/finance/ar/invoices/new">Create Invoice</Link> : null}
        </div>
      </div>

      {content}

      {importOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,12,30,0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) onCloseImport();
          }}
        >
          <div
            style={{
              width: 1060,
              maxWidth: '96vw',
              maxHeight: '85vh',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid rgba(11,12,30,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Import Invoices (Draft Only)</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
                  Upload a CSV/XLSX template. Valid rows will create DRAFT invoices; invalid rows will be rejected with reasons.
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.62)', lineHeight: 1.4 }}>
                  Grouping: rows with the same <b>invoiceRef</b> are grouped into <b>one invoice</b> with <b>multiple lines</b>.
                  Template rows flagged as <b>SAMPLE</b> are ignored during preview/import.
                </div>
              </div>
              <button type="button" onClick={onCloseImport}>
                Close
              </button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={importBusy} onClick={onDownloadCsv}>
                  Download CSV Template
                </button>
                <button type="button" disabled={importBusy} onClick={onDownloadXlsx}>
                  Download XLSX Template
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept={acceptExt.join(',')}
                  onChange={(e) => selectImportFile(e.target.files?.[0] ?? null)}
                  disabled={importBusy}
                />
                {importFile ? <div style={{ marginTop: 6, fontSize: 12, color: '#444' }}>{importFile.name}</div> : null}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={!importFile || importBusy} onClick={onPreview}>
                  {importBusy ? 'Working...' : 'Preview'}
                </button>
                <button
                  type="button"
                  disabled={!importFile || importBusy || importSubmitting || (preview ? preview.validCount === 0 : true)}
                  onClick={onImport}
                >
                  {importSubmitting ? 'Submitting…' : importBusy ? 'Working...' : 'Confirm Import'}
                </button>
                <button type="button" disabled={importBusy} onClick={resetImportState}>
                  Reset
                </button>
              </div>

              {importError ? <div style={{ marginTop: 12, color: 'crimson' }}>{importError}</div> : null}

              {preview ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: '#444' }}>
                    Preview: {preview.totalRows} rows ({preview.validCount} valid, {preview.invalidCount} invalid)
                  </div>
                  <div style={{ overflowX: 'auto', marginTop: 10 }}>
                    {groupedPreview.map((g) => {
                      const anyInvalid = g.rows.some((r) => (r.errors ?? []).length > 0);
                      return (
                        <div key={g.invoiceRef} style={{ marginBottom: 14, border: '1px solid rgba(11,12,30,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ padding: 10, background: anyInvalid ? 'rgba(220,20,60,0.08)' : 'rgba(11,12,30,0.03)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ fontWeight: 800 }}>Invoice Ref: {g.invoiceRef}</div>
                            <div style={{ fontSize: 12, color: anyInvalid ? 'crimson' : '#444' }}>
                              {g.rows.filter((r) => (r.errors ?? []).length === 0).length} valid / {g.rows.length} rows
                            </div>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Row</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer Code</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice Date</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Due Date</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Revenue Acct</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Currency</th>
                                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
                                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
                                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Discount %</th>
                                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Discount Amt</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Errors</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((r) => {
                                  const invalid = (r.errors ?? []).length > 0;
                                  const pct = Number((r as any).discountPercent ?? 0);
                                  const amt = Number((r as any).discountAmount ?? 0);
                                  return (
                                    <tr key={r.rowNumber} style={{ background: invalid ? 'rgba(220,20,60,0.08)' : 'transparent' }}>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.rowNumber}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerCode}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.invoiceDate}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.dueDate}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.revenueAccountCode}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.currency}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(r.quantity ?? 0))}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(r.unitPrice ?? 0), r.currency)}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{pct > 0 ? `${pct.toFixed(2)}%` : ''}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{amt > 0 ? formatMoney(amt, r.currency) : ''}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.description}</td>
                                      <td style={{ padding: 8, borderBottom: '1px solid #eee', color: invalid ? 'crimson' : '#444' }}>{(r.errors ?? []).join('; ')}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {importResult ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: '#444' }}>
                    Import Result: {importResult.createdCount} created, {importResult.failedCount} failed (total {importResult.totalRows})
                  </div>
                  {importResult.failedRows.length > 0 ? (
                    <div style={{ marginTop: 10, overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Row</th>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.failedRows.map((fr) => (
                            <tr key={fr.rowNumber}>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{fr.rowNumber}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee', color: 'crimson' }}>{fr.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
