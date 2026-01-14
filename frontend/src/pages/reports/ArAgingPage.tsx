import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { getArAging, type ArAgingResponse } from '../../services/reports';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n).toFixed(2);
}

export function ArAgingPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.REPORT.VIEW.AR_AGING);

  const [asOf, setAsOf] = useState(todayIsoDate());
  const [data, setData] = useState<ArAgingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = useMemo(() => !loading && data && data.customers.length === 0, [data, loading]);

  async function run() {
    if (!canView) return;
    setError(null);
    setLoading(true);
    try {
      const res = await getArAging({ asOf });
      setData(res);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load AR Aging';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  const buckets = data?.buckets ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>AR Aging</h2>
        <Link to="/reports">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view AR Aging.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          As at
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <button onClick={run} disabled={!canView || loading}>
          {loading ? 'Loading...' : 'Run'}
        </button>
      </div>

      {error ? <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div> : null}
      {isEmpty ? <div style={{ marginTop: 12, color: '#666' }}>No outstanding customer invoices as at selected date.</div> : null}

      {data ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
              {buckets.map((b) => (
                <th key={b.code} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
                  {b.label}
                </th>
              ))}
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.customerId}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.customerName}</td>
                {buckets.map((b) => (
                  <td key={b.code} style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    {money(c.totalsByBucket[b.code] ?? 0)}
                  </td>
                ))}
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(c.totalOutstanding)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Totals</td>
              {buckets.map((b) => (
                <td key={b.code} style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>
                  {money(data.grandTotalsByBucket[b.code] ?? 0)}
                </td>
              ))}
              <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(data.grandTotalOutstanding)}</td>
            </tr>
          </tfoot>
        </table>
      ) : null}

      {data ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This report is grouped by customer only (no drill-down).</div> : null}
    </div>
  );
}
