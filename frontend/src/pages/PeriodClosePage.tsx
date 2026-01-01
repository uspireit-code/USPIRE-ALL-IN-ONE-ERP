import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../services/api';
import {
  completePeriodCloseChecklistItem,
  getPeriodCloseChecklist,
  type PeriodCloseChecklistResponse,
} from '../services/periodClose';

export function PeriodClosePage() {
  const { periodId = '' } = useParams();
  const { hasPermission } = useAuth();

  const canReview = hasPermission('FINANCE_PERIOD_REVIEW');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<PeriodCloseChecklistResponse | null>(null);

  const errBody = (error as ApiError | any)?.body;

  const isOpen = data?.period.status === 'OPEN';

  async function load() {
    if (!periodId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getPeriodCloseChecklist(periodId);
      setData(resp);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  const items = useMemo(() => data?.checklist.items ?? [], [data?.checklist.items]);

  async function onComplete(itemId: string) {
    if (!canReview) return;
    if (!isOpen) return;

    setError(null);
    try {
      await completePeriodCloseChecklistItem({ periodId, itemId });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  if (!periodId) {
    return <div>Missing periodId</div>;
  }

  if (loading && !data) {
    return <div>Loading...</div>;
  }

  if (error && !data) {
    return <div>Error: {JSON.stringify(errBody ?? error)}</div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Month-End Close Checklist</h2>

      <div style={{ marginBottom: 12 }}>
        <div>
          <strong>Period:</strong> {data?.period.name}
        </div>
        <div>
          <strong>Status:</strong> {data?.period.status}
        </div>
      </div>

      {error ? <div style={{ color: 'crimson' }}>Error: {JSON.stringify(errBody ?? error)}</div> : null}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Item</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed By</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed At</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const canComplete = canReview && isOpen && i.status === 'PENDING';
            return (
              <tr key={i.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{i.code}</div>
                </td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.status}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.completedBy?.email ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.completedAt ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                  <button disabled={!canComplete} onClick={() => onComplete(i.id)}>
                    Mark as Completed
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!isOpen ? <div style={{ marginTop: 12 }}>Checklist is read-only because the period is not OPEN.</div> : null}
      {isOpen && !canReview ? (
        <div style={{ marginTop: 12 }}>You do not have permission to complete checklist items.</div>
      ) : null}
    </div>
  );
}
