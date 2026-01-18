import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import { listSuppliers, type Supplier } from '../../services/ap';
import {
  getSupplierStatement,
  exportSupplierStatement,
  type SupplierStatementLine,
  type SupplierStatementResponse,
} from '../../services/apSupplierStatements';
import { triggerBrowserDownload } from '../../services/apExports';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function SupplierStatementsPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.AP.SUPPLIER.VIEW) ||
    hasPermission(PERMISSIONS.REPORT.VIEW.SUPPLIER_STATEMENT);

  const canExport = hasPermission(PERMISSIONS.AP.STATEMENT_EXPORT);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersLoadError, setSuppliersLoadError] = useState<string | null>(null);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);

  const [supplierId, setSupplierId] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayIsoDate());

  const [data, setData] = useState<SupplierStatementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [attempted, setAttempted] = useState(false);

  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

  const clientValidationError = useMemo(() => {
    if (!canView) return '';
    if (!supplierId.trim()) return 'Please select a supplier.';

    if (!from.trim() || !to.trim()) {
      return 'Please choose a start and end date.';
    }
    const f = new Date(from);
    const t = new Date(to);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 'Date range is invalid.';
    if (from > to) return 'End date must be after start date.';

    return '';
  }, [canView, from, supplierId, to]);

  async function onExport(format: 'pdf' | 'excel') {
    if (!canView || !canExport) return;

    setAttempted(true);
    setError(null);

    const msg = clientValidationError;
    if (msg) {
      setError({ body: { message: msg } });
      return;
    }

    setLoading(true);
    try {
      const out = await exportSupplierStatement({
        supplierId: supplierId.trim(),
        fromDate: from,
        toDate: to,
        format,
      });
      triggerBrowserDownload(out.blob, out.fileName);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    void loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function loadSuppliers() {
    if (!canView) return;

    setSuppliersLoading(true);
    setSuppliersLoadError(null);
    try {
      const rows = await listSuppliers();
      setSuppliers(rows);
      setSuppliersLoaded(true);
    } catch {
      setSuppliersLoadError('Unable to load supplier list.');
      setSuppliersLoaded(true);
    } finally {
      setSuppliersLoading(false);
    }
  }

  async function run() {
    if (!canView) return;

    setAttempted(true);
    setError(null);

    const msg = clientValidationError;
    if (msg) {
      setError({ body: { message: msg } });
      return;
    }

    setLoading(true);
    try {
      const res = await getSupplierStatement({ supplierId: supplierId.trim(), from, to });
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const errBody = (error as ApiError | any)?.body;
  const errMsg =
    typeof errBody?.message === 'string'
      ? errBody.message
      : typeof errBody === 'string'
        ? errBody
        : typeof errBody?.error === 'string'
          ? errBody.error
          : typeof errBody?.reason === 'string'
            ? errBody.reason
            : error
              ? 'Failed to load supplier statement.'
              : '';

  const showSupplierRequiredError = attempted && !supplierId.trim();
  const showNoSuppliers = suppliersLoaded && !suppliersLoading && suppliers.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Supplier Statements</h2>
        <Link to="/finance/ap/suppliers">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view supplier statements.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          Supplier
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={!canView}
            style={{ minWidth: 280 }}
          >
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {showSupplierRequiredError ? <div style={{ color: 'crimson' }}>Please select a supplier.</div> : null}

        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!canView} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!canView} />
        </label>

        <button onClick={() => void run()} disabled={!canView || loading}>
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {canView && canExport ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void onExport('pdf')} disabled={loading}>
              Export PDF
            </button>
            <button onClick={() => void onExport('excel')} disabled={loading}>
              Export Excel
            </button>
          </div>
        ) : null}
      </div>

      {showNoSuppliers ? (
        <div style={{ color: '#666', marginTop: 8 }}>
          No suppliers found. Create suppliers before generating statements.
        </div>
      ) : null}

      {suppliersLoadError ? <div style={{ color: '#666', marginTop: 8 }}>{suppliersLoadError}</div> : null}

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? (
        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
      ) : null}

      {data ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{data.supplierName}</div>
              <div style={{ color: '#666', fontSize: 12 }}>
                Period: {data.from} → {data.to}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#666', fontSize: 12 }}>Opening balance</div>
              <div style={{ fontWeight: 700 }}>{money(data.openingBalance)}</div>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Reference</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Debit</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Credit</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Running balance</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 10, color: '#666' }}>
                    No transactions in selected window.
                  </td>
                </tr>
              ) : (
                data.lines.map((t: SupplierStatementLine, idx: number) => (
                  <tr key={`${t.type}-${t.reference}-${idx}`}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.date}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.type}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{t.reference}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{t.debit ? money(t.debit) : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{t.credit ? money(t.credit) : ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(t.runningBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700, textAlign: 'right' }}>
                  Closing balance
                </td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700, textAlign: 'right' }}>{money(data.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            This is a read-only statement generated on demand. Each view is audited.
          </div>
        </div>
      ) : null}
    </div>
  );
}
