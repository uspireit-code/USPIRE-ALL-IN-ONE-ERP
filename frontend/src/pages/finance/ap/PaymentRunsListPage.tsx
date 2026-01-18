import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { listPaymentRuns, type PaymentRun } from '../../../services/paymentRuns';

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function PaymentRunsListPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_RUN_VIEW);
  }, [state.me]);

  const canExecute = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_RUN_EXECUTE);
  }, [state.me]);

  const [rows, setRows] = useState<PaymentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const res = await listPaymentRuns();
      const list = Array.isArray(res) ? res : [];
      // Default sort newest first (backend already does, but keep defensive)
      list.sort((a, b) => String(b.executedAt ?? '').localeCompare(String(a.executedAt ?? '')));
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load payment runs'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Payment Runs</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Payment Runs</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Read-only history of executed AP payment runs.
          </div>
        </div>
        {canExecute ? (
          <Link
            to="/finance/ap/payment-runs/execute"
            style={{
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 14px',
              borderRadius: 8,
              background: '#020445',
              color: 'white',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Execute Payment Run
          </Link>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Failed to load">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>{error}</div>
              <button
                onClick={() => void load()}
                style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #ccc', background: 'white' }}
              >
                Retry
              </button>
            </div>
          </Alert>
        ) : null}

        {loading ? <div>Loading...</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <Alert tone="info" title="No payment runs">
            No payment runs found.
          </Alert>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ padding: '10px 8px' }}>Run Number</th>
                  <th style={{ padding: '10px 8px' }}>Execution Date</th>
                  <th style={{ padding: '10px 8px' }}>Accounting Period</th>
                  <th style={{ padding: '10px 8px' }}>Bank / Cash Account</th>
                  <th style={{ padding: '10px 8px' }}>Total Amount</th>
                  <th style={{ padding: '10px 8px' }}>Executed By</th>
                  <th style={{ padding: '10px 8px' }}>Executed At</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onClick={() => navigate(`/finance/ap/payment-runs/${r.id}`)}
                  >
                    <td style={{ padding: '10px 8px' }}>
                      <Link to={`/finance/ap/payment-runs/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        {r.runNumber}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{String(r.executionDate ?? '').slice(0, 10) || '-'}</td>
                    <td style={{ padding: '10px 8px' }}>{r.period?.name ?? r.periodId}</td>
                    <td style={{ padding: '10px 8px' }}>{r.bankAccount?.name ?? r.bankAccountId}</td>
                    <td style={{ padding: '10px 8px' }}>{money(Number(r.totalAmount ?? 0))}</td>
                    <td style={{ padding: '10px 8px' }}>{r.executedBy?.name ?? r.executedBy?.email ?? r.executedByUserId}</td>
                    <td style={{ padding: '10px 8px' }}>{String(r.executedAt ?? '').replace('T', ' ').slice(0, 19) || '-'}</td>
                    <td style={{ padding: '10px 8px' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
