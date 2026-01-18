import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import { listSuppliers, type Supplier } from '../../services/ap';
import { getApAging, type ApAgingRow } from '../../services/apAging';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function ApAgingPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.REPORT.VIEW.AP_AGING) ||
    hasPermission(PERMISSIONS.FINANCE.VIEW_ALL) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);

  const [asOfDate, setAsOfDate] = useState(todayIsoDate());
  const [supplierId, setSupplierId] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);

  const [rows, setRows] = useState<ApAgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!canView) return;
    void loadSuppliers();
    void run({ nextAsOfDate: asOfDate, nextSupplierId: supplierId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function loadSuppliers() {
    if (!canView) return;
    try {
      const res = await listSuppliers();
      setSuppliers(res);
    } catch {
      setSuppliers([]);
    } finally {
      setSuppliersLoaded(true);
    }
  }

  async function run(params?: { nextAsOfDate?: string; nextSupplierId?: string }) {
    if (!canView) return;

    const nextAsOfDate = (params?.nextAsOfDate ?? asOfDate).trim();
    const nextSupplierId = (params?.nextSupplierId ?? supplierId).trim();

    setError(null);
    setLoading(true);
    try {
      const res = await getApAging({
        asOfDate: nextAsOfDate,
        supplierId: nextSupplierId ? nextSupplierId : undefined,
      });
      setRows(res);
    } catch (e) {
      setRows([]);
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
              ? 'Failed to load AP Aging.'
              : '';

  const totals = useMemo(() => {
    const out = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_91_plus: 0,
      totalOutstanding: 0,
    };
    for (const r of rows) {
      out.current += Number(r.current ?? 0);
      out.days_1_30 += Number(r.days_1_30 ?? 0);
      out.days_31_60 += Number(r.days_31_60 ?? 0);
      out.days_61_90 += Number(r.days_61_90 ?? 0);
      out.days_91_plus += Number(r.days_91_plus ?? 0);
      out.totalOutstanding += Number(r.totalOutstanding ?? 0);
    }
    return out;
  }, [rows]);

  const showNoData = !loading && canView && !errMsg && rows.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>AP Aging</h2>
        <Link to="/finance/ap/suppliers">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>Access denied.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          As at
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} disabled={!canView} />
        </label>

        <label>
          Supplier (optional)
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={!canView || !suppliersLoaded}
            style={{ minWidth: 280 }}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => void run({ nextAsOfDate: asOfDate, nextSupplierId: supplierId })}
          disabled={!canView || loading || !asOfDate.trim()}
        >
          {loading ? 'Loading AP Aging…' : 'Refresh'}
        </button>
      </div>

      {loading ? <div style={{ marginTop: 12, color: '#666' }}>Loading AP Aging…</div> : null}
      {errMsg ? <div style={{ marginTop: 12, color: 'crimson' }}>{errMsg}</div> : null}
      {showNoData ? (
        <div style={{ marginTop: 12, color: '#666' }}>No outstanding supplier balances</div>
      ) : null}

      {!loading && !errMsg && rows.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Supplier</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Current</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>1–30</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>31–60</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>61–90</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>91+</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supplierId}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.supplierName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.current)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.days_1_30)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.days_31_60)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.days_61_90)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.days_91_plus)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.totalOutstanding)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Grand Total</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.current)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.days_1_30)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.days_31_60)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.days_61_90)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.days_91_plus)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.totalOutstanding)}</td>
            </tr>
          </tfoot>
        </table>
      ) : null}
    </div>
  );
}
