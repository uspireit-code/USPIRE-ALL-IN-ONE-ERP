import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listReviewQueue, rejectJournal, type JournalReviewQueueItem } from '../../../services/gl';

function formatMoney(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function RiskBadge(props: { riskScore?: number | null }) {
  const s = typeof props.riskScore === 'number' ? props.riskScore : 0;
  const band = s >= 40 ? 'HIGH' : s >= 20 ? 'MEDIUM' : 'LOW';
  const bg = band === 'HIGH' ? '#fee2e2' : band === 'MEDIUM' ? '#ffedd5' : '#e7f6ec';
  const color = band === 'HIGH' ? '#991b1b' : band === 'MEDIUM' ? '#9a3412' : '#166534';

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {band}
    </span>
  );
}

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canApprove = hasPermission('FINANCE_GL_APPROVE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<JournalReviewQueueItem[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  async function refresh() {
    if (!canApprove) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listReviewQueue();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load review queue'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmReject() {
    if (!rejectingId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required.');
      return;
    }
    setRejectBusy(true);
    setError(null);
    try {
      await rejectJournal(rejectingId, reason);
      setItems((prev) => prev.filter((x) => x.id !== rejectingId));
      setToast('Journal rejected');
      window.setTimeout(() => setToast(null), 2500);
      setRejectingId(null);
      setRejectReason('');
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to reject journal'));
    } finally {
      setRejectBusy(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canApprove]);

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canApprove) {
    return (
      <div>
        <h2>Review Queue</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to access the Review Queue.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div>
      {toast ? (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 5,
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px solid ${tokens.colors.border.subtle}`,
            background: '#e7f6ec',
            color: '#166534',
            fontWeight: 650,
            maxWidth: 820,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Review Queue</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
        Journals pending approval.
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
        Legal Entity and Department / Cost Centre are shown in the journal detail view.
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', color: tokens.colors.text.muted }}>Loading…</div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>No journals pending approval.</div>
      ) : null}

      {!loading && items.length > 0 ? (
        <DataTable style={{ marginTop: 12 }}>
          <DataTable.Head>
            <tr>
              <DataTable.Th>Journal Date</DataTable.Th>
              <DataTable.Th>Reference</DataTable.Th>
              <DataTable.Th>Description</DataTable.Th>
              <DataTable.Th>Risk</DataTable.Th>
              <DataTable.Th align="right">Debit</DataTable.Th>
              <DataTable.Th align="right">Credit</DataTable.Th>
              <DataTable.Th>Prepared By</DataTable.Th>
              <DataTable.Th>Period</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {items.map((j, idx) => (
              <DataTable.Row key={j.id} zebra index={idx}>
                <DataTable.Td>{j.journalDate.slice(0, 10)}</DataTable.Td>
                <DataTable.Td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.reference ?? ''}</DataTable.Td>
                <DataTable.Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description ?? ''}</DataTable.Td>
                <DataTable.Td>
                  <RiskBadge riskScore={j.riskScore ?? 0} />
                </DataTable.Td>
                <DataTable.Td align="right">{formatMoney(j.totalDebit)}</DataTable.Td>
                <DataTable.Td align="right">{formatMoney(j.totalCredit)}</DataTable.Td>
                <DataTable.Td>
                  <div style={{ fontWeight: 650 }}>{j.createdBy?.name || j.createdBy?.email || '—'}</div>
                  {j.createdBy?.email ? <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{j.createdBy.email}</div> : null}
                </DataTable.Td>
                <DataTable.Td>{j.period?.label || '—'}</DataTable.Td>
                <DataTable.Td align="right">
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => navigate(`/finance/gl/journals/${j.id}?from=review`)}
                      style={{ fontSize: 12, fontWeight: 750 }}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => {
                        setRejectingId(j.id);
                        setRejectReason('');
                        setError(null);
                      }}
                      disabled={rejectBusy}
                      style={{ fontSize: 12 }}
                    >
                      Reject
                    </button>
                  </div>
                </DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      ) : null}

      {rejectingId ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (rejectBusy) return;
              setRejectingId(null);
              setRejectReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '18vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(640px, calc(100vw - 32px))',
              background: tokens.colors.white,
              borderRadius: 12,
              border: `1px solid ${tokens.colors.border.subtle}`,
              boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
              zIndex: 71,
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 850, fontSize: 16 }}>Reject Journal</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>A rejection reason is required.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
                disabled={rejectBusy}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (rejectBusy) return;
                  setRejectingId(null);
                  setRejectReason('');
                }}
                disabled={rejectBusy}
              >
                Cancel
              </button>
              <button onClick={onConfirmReject} disabled={rejectBusy} style={{ fontWeight: 750 }}>
                {rejectBusy ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <Link to="/finance/gl/journals">Back to Journals</Link>
      </div>
    </div>
  );
}
