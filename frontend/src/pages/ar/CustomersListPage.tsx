import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Customer } from '../../services/ar';
import {
  downloadCustomersImportCsvTemplate,
  downloadCustomersImportXlsxTemplate,
  importCustomers,
  listCustomers,
  previewCustomersImport,
  type CustomersImportPreviewResponse,
  type CustomersImportResponse,
} from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

export function CustomersListPage() {
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission('CUSTOMERS_CREATE');
  const canImportCustomers = hasPermission('CUSTOMERS_IMPORT');

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CustomersImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<CustomersImportResponse | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listCustomers()
      .then((res) => {
        if (!mounted) return;
        setRows(res.items ?? []);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load customers'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  };

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
    if (!canImportCustomers) return;
    resetImportState();
    setImportOpen(true);
  };

  const onCloseImport = () => {
    setImportOpen(false);
  };

  const acceptExt = ['.csv', '.xlsx'];
  const maxBytes = 10 * 1024 * 1024;

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

  const onPreview = async () => {
    if (!importFile) return;
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await previewCustomersImport(importFile);
      setPreview(res);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Preview failed'));
    } finally {
      setImportBusy(false);
    }
  };

  const onImport = async () => {
    if (!importFile) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await importCustomers(importFile);
      setImportResult(res);
      await Promise.resolve();
      load();
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Import failed'));
    } finally {
      setImportBusy(false);
    }
  };

  const onDownloadCsv = async () => {
    setImportError(null);
    try {
      const out = await downloadCustomersImportCsvTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Failed to download CSV template'));
    }
  };

  const onDownloadXlsx = async () => {
    setImportError(null);
    try {
      const out = await downloadCustomersImportXlsxTemplate();
      triggerDownload(out.blob, out.fileName);
    } catch (e: any) {
      setImportError(getApiErrorMessage(e, 'Failed to download XLSX template'));
    }
  };

  const content = useMemo(() => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    if (rows.length === 0) {
      return <div style={{ color: '#666' }}>No customers found.</div>;
    }

    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/finance/ar/customers/${c.id}`}>{c.customerCode ?? '-'}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/finance/ar/customers/${c.id}`}>{c.name}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customers</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {canImportCustomers ? (
            <button type="button" onClick={onOpenImport}>
              Import Customers
            </button>
          ) : null}
          {canCreateCustomer ? <Link to="/finance/ar/customers/new">Create Customer</Link> : null}
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
              width: 980,
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
                <div style={{ fontSize: 16, fontWeight: 800 }}>Import Customers</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
                  Download a template, upload a CSV/XLSX file, preview rows, then confirm import.
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
                <button type="button" disabled={!importFile || importBusy || (preview ? preview.validCount === 0 : true)} onClick={onImport}>
                  {importBusy ? 'Working...' : 'Confirm Import'}
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
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Row</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r) => {
                          const invalid = (r.errors ?? []).length > 0;
                          return (
                            <tr key={r.rowNumber} style={{ background: invalid ? 'rgba(220,20,60,0.08)' : 'transparent' }}>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.rowNumber}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerCode ?? ''}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.name}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.email}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.status ?? ''}</td>
                              <td style={{ padding: 8, borderBottom: '1px solid #eee', color: invalid ? 'crimson' : '#444' }}>
                                {(r.errors ?? []).join('; ')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {importResult ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: '#444' }}>
                    Import Result: {importResult.importedCount} imported, {importResult.failedCount} failed (total {importResult.totalRows})
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
