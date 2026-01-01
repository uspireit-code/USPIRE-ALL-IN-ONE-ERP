import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../services/api';
import { listGlPeriods, type AccountingPeriod } from '../services/gl';

export function PeriodsPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission('FINANCE_PERIOD_VIEW');
  const canClose = hasPermission('FINANCE_PERIOD_CLOSE_APPROVE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  const errBody = (error as ApiError | any)?.body;

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const p = await listGlPeriods();
      setPeriods(p);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...periods].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [periods]);

  if (!canView) {
    return <div>You do not have permission to view accounting periods.</div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Accounting Periods</h2>

      <div style={{ marginTop: 12 }}>
        <button onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
        </div>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Period</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Dates</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{p.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                {String(p.startDate).slice(0, 10)} – {String(p.endDate).slice(0, 10)}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{p.status}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                {canClose ? <Link to={`/periods/${p.id}/close`}>Month-End Close</Link> : <span style={{ fontSize: 12, color: '#666' }}>View only</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
