import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import type { ApiError } from '../services/api';
import {
  closeAccountingPeriod,
  completeAccountingPeriodChecklistItem,
  getAccountingPeriodChecklist,
  type AccountingPeriodChecklistItem,
  type AccountingPeriodChecklistResponse,
} from '../services/gl';
import { EvidencePanel } from '../components/EvidencePanel';
import { ReviewPackPanel } from '../components/ReviewPackPanel';

export function PeriodCloseWorkflowPage() {
  const { id = '' } = useParams();
  const { hasPermission } = useAuth();

  const canComplete = hasPermission(PERMISSIONS.PERIOD.CHECKLIST_COMPLETE);
  const canClose = hasPermission(PERMISSIONS.PERIOD.CLOSE_APPROVE);
  const canView = hasPermission(PERMISSIONS.PERIOD.VIEW);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<AccountingPeriodChecklistResponse | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  const errBody = (error as ApiError | any)?.body;

  const isOpen = data?.period.status === 'OPEN';

  async function load() {
    if (!id) return;
    if (!canView) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await getAccountingPeriodChecklist(id);
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
  }, [id]);

  const items = useMemo<AccountingPeriodChecklistItem[]>(() => data?.items ?? [], [data?.items]);

  const incompleteCount = useMemo(() => items.filter((i: AccountingPeriodChecklistItem) => !i.completed).length, [items]);

  async function onComplete(itemId: string) {
    if (!canComplete) return;
    if (!isOpen) return;

    setError(null);
    try {
      await completeAccountingPeriodChecklistItem({ periodId: id, itemId });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function onClose() {
    if (!canClose) return;
    setCloseLoading(true);
    setError(null);
    try {
      await closeAccountingPeriod(id);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setCloseLoading(false);
    }
  }

  if (!id) {
    return <div>Missing period id</div>;
  }

  if (!canView) {
    return <div>You do not have permission to view month-end close workflow.</div>;
  }

  if (loading && !data) {
    return <div>Loading...</div>;
  }

  if (error && !data) {
    return <div>Error: {JSON.stringify(errBody ?? error)}</div>;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Month-End Close</h2>
        <Link to="/periods">Back to periods</Link>
      </div>

      <div style={{ marginTop: 8, padding: 12, border: '1px solid #ddd', background: '#fafafa' }}>
        <div>
          <strong>Period:</strong> {data?.period.name}
        </div>
        <div>
          <strong>Status:</strong> {data?.period.status}
        </div>
        <div>
          <strong>Checklist:</strong> {items.length - incompleteCount}/{items.length} completed
        </div>
        {isOpen ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Control note: the user who completes checklist items cannot close the period (SoD).
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>This period is not OPEN, so checklist completion is locked.</div>
        )}
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
          <div style={{ fontWeight: 700 }}>Error</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>

        <button onClick={onClose} disabled={!canClose || closeLoading || (data?.period.status !== 'OPEN' ? true : incompleteCount > 0)}>
          {closeLoading ? 'Closing…' : 'Close Period'}
        </button>

        {!canClose ? <span style={{ fontSize: 12, color: '#666' }}>Missing permission: FINANCE_PERIOD_CLOSE_APPROVE</span> : null}
        {canClose && isOpen && incompleteCount > 0 ? (
          <span style={{ fontSize: 12, color: '#666' }}>Close is blocked until all checklist items are completed.</span>
        ) : null}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Item</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed By</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Completed At</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const canMark = canComplete && isOpen && !i.completed;
            return (
              <tr key={i.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{i.label}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{i.code}</div>
                </td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.completed ? 'YES' : 'NO'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.completedBy?.email ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{i.completedAt ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                  <button disabled={!canMark} onClick={() => onComplete(i.id)}>
                    Mark as Completed
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data?.period?.id ? (
        <>
          <EvidencePanel entityType="ACCOUNTING_PERIOD" entityId={data.period.id} uploadsEnabled={isOpen} />
          <ReviewPackPanel periodId={data.period.id} />
        </>
      ) : null}

      {isOpen && !canComplete ? (
        <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>You do not have permission to complete checklist items.</div>
      ) : null}
    </div>
  );
}
