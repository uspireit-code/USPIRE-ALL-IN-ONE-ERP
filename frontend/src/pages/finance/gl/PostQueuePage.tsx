import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listPostQueue, postJournal, returnJournalToReview, type JournalPostQueueItem } from '../../../services/gl';

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

export function PostQueuePage() {
  const navigate = useNavigate();
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canFinalPost = hasPermission(PERMISSIONS.GL.FINAL_POST);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [items, setItems] = useState<JournalPostQueueItem[]>([]);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const confirmItem = useMemo(() => items.find((i) => i.id === confirmId) ?? null, [confirmId, items]);
  const returnItem = useMemo(() => items.find((i) => i.id === returnId) ?? null, [returnId, items]);

  async function refresh() {
    if (!canFinalPost) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listPostQueue();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load post queue'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmReturn() {
    if (!returnId) return;
    const reason = returnReason.trim();
    if (!reason) {
      setError('Return reason is required.');
      return;
    }

    setBusyId(returnId);
    setError(null);
    try {
      await returnJournalToReview(returnId, reason);
      setItems((prev) => prev.filter((x) => x.id !== returnId));
      setToast('Journal returned to review');
      window.setTimeout(() => setToast(null), 2500);
      setReturnId(null);
      setReturnReason('');
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to return journal to review'));
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmPost() {
    if (!confirmId) return;
    setBusyId(confirmId);
    setError(null);
    try {
      await postJournal(confirmId);
      setItems((prev) => prev.filter((x) => x.id !== confirmId));
      setToast('Journal posted');
      window.setTimeout(() => setToast(null), 2500);
      setConfirmId(null);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to post journal'));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canFinalPost]);

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canFinalPost) {
    return (
      <div>
        <h2>Post Queue</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to access the Post Queue.
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
            maxWidth: 900,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2>Post Queue</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
        Approved journals pending final posting.
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
        Legal Entity and Department / Cost Centre are shown in the journal detail view.
      </div>

      {loading ? <div style={{ marginTop: 14, color: tokens.colors.text.muted }}>Loading…</div> : null}

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone={error.toLowerCase().includes('403') ? 'warning' : 'error'} title={error.toLowerCase().includes('403') ? 'Blocked' : 'Error'}>
            {error}
          </Alert>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>No journals pending posting.</div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <DataTable style={{ marginTop: 12 }}>
          <DataTable.Head>
            <tr>
              <DataTable.Th>Journal</DataTable.Th>
              <DataTable.Th>Date</DataTable.Th>
              <DataTable.Th>Reference</DataTable.Th>
              <DataTable.Th>Description</DataTable.Th>
              <DataTable.Th>Risk</DataTable.Th>
              <DataTable.Th align="right">Debit</DataTable.Th>
              <DataTable.Th align="right">Credit</DataTable.Th>
              <DataTable.Th>Prepared By</DataTable.Th>
              <DataTable.Th>Reviewed By</DataTable.Th>
              <DataTable.Th>Reviewed At</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {items.map((j, idx) => (
              <DataTable.Row key={j.id} zebra index={idx}>
                <DataTable.Td>
                  <button
                    onClick={() => navigate(`/finance/gl/journals/${j.id}`)}
                    style={{ fontSize: 12, fontWeight: 750 }}
                  >
                    {j.journalNumber ? `J${String(j.journalNumber).padStart(6, '0')}` : j.id.slice(0, 8)}
                  </button>
                </DataTable.Td>
                <DataTable.Td>{String(j.journalDate).slice(0, 10)}</DataTable.Td>
                <DataTable.Td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.reference ?? ''}</DataTable.Td>
                <DataTable.Td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description ?? ''}</DataTable.Td>
                <DataTable.Td>
                  <RiskBadge riskScore={j.riskScore ?? 0} />
                </DataTable.Td>
                <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{j.totalDebit.toFixed(2)}</DataTable.Td>
                <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{j.totalCredit.toFixed(2)}</DataTable.Td>
                <DataTable.Td>{j.createdBy?.email ?? '—'}</DataTable.Td>
                <DataTable.Td>{j.reviewedBy?.email ?? '—'}</DataTable.Td>
                <DataTable.Td>{j.reviewedAt ? new Date(j.reviewedAt).toLocaleString() : '—'}</DataTable.Td>
                <DataTable.Td align="right">
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setConfirmId(j.id)}
                      disabled={busyId !== null}
                      style={{ fontSize: 12, fontWeight: 750 }}
                    >
                      Post
                    </button>
                    <button
                      onClick={() => {
                        setReturnId(j.id);
                        setReturnReason('');
                        setError(null);
                      }}
                      disabled={busyId !== null}
                      style={{ fontSize: 12 }}
                    >
                      Return to Review
                    </button>
                  </div>
                </DataTable.Td>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      ) : null}

      {confirmId ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (busyId) return;
              setConfirmId(null);
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Confirm Posting</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              Posting will permanently record this journal to the ledger. This action cannot be undone.
            </div>
            <div style={{ fontSize: 13, color: tokens.colors.text.primary }}>
              {confirmItem?.journalNumber ? `Journal J${String(confirmItem.journalNumber).padStart(6, '0')}` : 'Journal'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (busyId) return;
                  setConfirmId(null);
                }}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>
              <button onClick={onConfirmPost} disabled={Boolean(busyId)} style={{ fontWeight: 750 }}>
                {busyId ? 'Posting…' : 'Confirm Post'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {returnId ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (busyId) return;
              setReturnId(null);
              setReturnReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '16vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(700px, calc(100vw - 32px))',
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Return to Review</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              This will send the journal back to the Review Queue and it must be re-approved before it can be posted.
            </div>

            <div style={{ fontSize: 13, color: tokens.colors.text.primary }}>
              {returnItem?.journalNumber ? `Journal J${String(returnItem.journalNumber).padStart(6, '0')}` : 'Journal'}
              {returnItem?.reference ? ` • ${returnItem.reference}` : ''}
            </div>

            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason for returning to review *
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
                disabled={Boolean(busyId)}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (busyId) return;
                  setReturnId(null);
                  setReturnReason('');
                }}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>
              <button
                onClick={onConfirmReturn}
                disabled={Boolean(busyId) || !returnReason.trim()}
                style={{ fontWeight: 750 }}
              >
                {busyId ? 'Returning…' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
