import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import { listCustomers, type Customer } from '../../services/ar';
import { getArAgingReport, type ArAgingReportResponse, type ArAgingReportRow } from '../../services/arAging';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function ArAgingPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.AR.AGING.VIEW);
  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

  const [asOf, setAsOf] = useState(todayIsoDate());
  const [customerId, setCustomerId] = useState<string>('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [data, setData] = useState<ArAgingReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const isEmpty = useMemo(() => !loading && data && data.rows.length === 0, [data, loading]);

  useEffect(() => {
    if (!canView) return;
    setCustomersLoading(true);
    void listCustomers({ page: 1, pageSize: 200, status: 'ACTIVE' })
      .then((resp) => setCustomers((resp as any)?.items ?? []))
      .catch(() => undefined)
      .finally(() => setCustomersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function run() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await getArAgingReport({ asOf, customerId: customerId.trim() || undefined });
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
              ? 'Failed to load AR Aging.'
              : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>AR Aging</h2>
        <Link to="/ar">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view AR Aging.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <label>
          As of
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>

        <label>
          Customer (optional)
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={!canView || customersLoading}
            style={{ minWidth: 260 }}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => void run()} disabled={!canView || loading}>
          {loading ? 'Loading…' : 'Run'}
        </button>
      </div>

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? (
        <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
      ) : null}

      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No outstanding customer invoices as of selected date.</div> : null}

      {data ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Current</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>0–30</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>31–60</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>61–90</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>90+</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r: ArAgingReportRow) => (
              <tr key={r.customerId}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.customerName}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.current)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.b0_30)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.b31_60)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.b61_90)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.b90_plus)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Totals</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.current)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.b0_30)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.b31_60)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.b61_90)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.b90_plus)}</td>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : null}

      {data ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Read-only report. Data calculated by backend as-of date.</div> : null}
    </div>
  );
}
