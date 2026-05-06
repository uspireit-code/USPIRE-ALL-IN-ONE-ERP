import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import {
  approveCoaReclassification,
  createCoaReclassification,
  listCoa,
  listCoaReclassifications,
  rejectCoaReclassification,
  submitCoaReclassification,
  type CoaAccount,
  type CoaReclassification,
} from '../../services/coa';

export function CoaReclassificationsPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canUpdate = hasPermission(PERMISSIONS.COA.UPDATE);
  const canApprove = hasPermission(PERMISSIONS.COA.APPROVE);

  const myUserId = state.me?.user?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [rows, setRows] = useState<CoaReclassification[]>([]);

  const [accountId, setAccountId] = useState('');
  const [effectiveStartDate, setEffectiveStartDate] = useState('');
  const [newParentAccountId, setNewParentAccountId] = useState<string>('');
  const [newIfrsMappingCode, setNewIfrsMappingCode] = useState('');
  const [newFsMappingLevel1, setNewFsMappingLevel1] = useState('');
  const [newFsMappingLevel2, setNewFsMappingLevel2] = useState('');
  const [reason, setReason] = useState('');

  const [busy, setBusy] = useState(false);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const accountById = useMemo(() => {
    const m = new Map<string, CoaAccount>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [a, r] = await Promise.all([listCoa(), listCoaReclassifications()]);
      setAccounts(Array.isArray(a?.accounts) ? a.accounts : []);
      setRows(Array.isArray(r?.reclassifications) ? r.reclassifications : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load reclassifications'));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
    if (!canUpdate) return;
    const aid = accountId.trim();
    const eff = effectiveStartDate.trim();
    if (!aid) {
      setError('Account is required');
      return;
    }
    if (!eff) {
      setError('Effective start date is required');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await createCoaReclassification({
        accountId: aid,
        effectiveStartDate: eff,
        newParentAccountId: newParentAccountId.trim() ? newParentAccountId.trim() : null,
        newIfrsMappingCode: newIfrsMappingCode.trim() ? newIfrsMappingCode.trim() : null,
        newFsMappingLevel1: newFsMappingLevel1.trim() ? newFsMappingLevel1.trim() : null,
        newFsMappingLevel2: newFsMappingLevel2.trim() ? newFsMappingLevel2.trim() : null,
        reason: reason.trim() ? reason.trim() : null,
      });
      setToast('Reclassification created');
      window.setTimeout(() => setToast(null), 2500);
      setAccountId('');
      setEffectiveStartDate('');
      setNewParentAccountId('');
      setNewIfrsMappingCode('');
      setNewFsMappingLevel1('');
      setNewFsMappingLevel2('');
      setReason('');
      await refresh();
      void res;
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to create reclassification'));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(id: string) {
    setBusy(true);
    setError(null);
    try {
      await submitCoaReclassification(id);
      setToast('Reclassification submitted for approval');
      window.setTimeout(() => setToast(null), 2500);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to submit reclassification'));
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await approveCoaReclassification(id);
      setToast('Reclassification approved');
      window.setTimeout(() => setToast(null), 2500);
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to approve reclassification'));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmReject() {
    if (!rejectingId) return;
    const reasonText = rejectReason.trim();
    if (!reasonText) {
      setError('Rejection reason is required.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await rejectCoaReclassification(rejectingId, { rejectionReason: reasonText });
      setToast('Reclassification rejected');
      window.setTimeout(() => setToast(null), 2500);
      setRejectingId(null);
      setRejectReason('');
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to reject reclassification'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {toast ? (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 5,
            marginBottom: 4,
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px solid ${tokens.colors.border.subtle}`,
            background: '#e7f6ec',
            color: '#166534',
            fontWeight: 650,
            maxWidth: 920,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850 }}>COA Reclassifications</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>
            Effective-dated COA reclassification requests.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button variant="secondary" onClick={refresh} disabled={loading || busy}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error" title="Error">{error}</Alert> : null}

      {canUpdate ? (
        <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>New Request</div>
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Account</div>
              <div style={{ marginTop: 6 }}>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={busy}
                  style={{ width: '100%', height: 40, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, padding: '0 12px', outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="">Select account…</option>
                  {accounts
                    .slice()
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Effective start date</div>
              <div style={{ marginTop: 6 }}>
                <Input value={effectiveStartDate} onChange={(e) => setEffectiveStartDate(e.target.value)} placeholder="YYYY-MM-DD" disabled={busy} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>New parent (optional)</div>
              <div style={{ marginTop: 6 }}>
                <select
                  value={newParentAccountId}
                  onChange={(e) => setNewParentAccountId(e.target.value)}
                  disabled={busy}
                  style={{ width: '100%', height: 40, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, padding: '0 12px', outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="">(No change)</option>
                  {accounts
                    .slice()
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>New IFRS mapping (optional)</div>
              <div style={{ marginTop: 6 }}>
                <Input value={newIfrsMappingCode} onChange={(e) => setNewIfrsMappingCode(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>New FS mapping level 1 (optional)</div>
              <div style={{ marginTop: 6 }}>
                <Input value={newFsMappingLevel1} onChange={(e) => setNewFsMappingLevel1(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>New FS mapping level 2 (optional)</div>
              <div style={{ marginTop: 6 }}>
                <Input value={newFsMappingLevel2} onChange={(e) => setNewFsMappingLevel2(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Reason (optional)</div>
              <div style={{ marginTop: 6 }}>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={onCreate} disabled={busy}>
                {busy ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Alert tone="warning" title="Read only">
          You do not have permission to create reclassification requests.
        </Alert>
      )}

      <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff' }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>Requests</div>
        <div style={{ padding: 14 }}>
          {loading ? <div style={{ color: tokens.colors.text.muted }}>Loading…</div> : null}
          {!loading && rows.length === 0 ? <div style={{ color: tokens.colors.text.muted }}>No reclassification requests.</div> : null}

          {!loading && rows.length > 0 ? (
            <DataTable>
              <DataTable.Head>
                <tr>
                  <DataTable.Th>Status</DataTable.Th>
                  <DataTable.Th>Account</DataTable.Th>
                  <DataTable.Th>Effective</DataTable.Th>
                  <DataTable.Th>Requested At</DataTable.Th>
                  <DataTable.Th align="right">Actions</DataTable.Th>
                </tr>
              </DataTable.Head>
              <DataTable.Body>
                {rows.map((r, idx) => {
                  const a = accountById.get(r.accountId);
                  const canSubmit = canUpdate && r.status === 'DRAFT' && (!myUserId || r.requestedById === myUserId);
                  const canApproveRow = canApprove && r.status === 'PENDING';

                  return (
                    <DataTable.Row key={r.id} zebra index={idx}>
                      <DataTable.Td style={{ fontWeight: 750 }}>{r.status}</DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontWeight: 650 }}>{a ? `${a.code} — ${a.name}` : r.accountId}</div>
                        {r.reason ? <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Reason: {r.reason}</div> : null}
                      </DataTable.Td>
                      <DataTable.Td>{String(r.effectiveStartDate ?? '').slice(0, 10)}</DataTable.Td>
                      <DataTable.Td>{String(r.requestedAt ?? '').slice(0, 19).replace('T', ' ')}</DataTable.Td>
                      <DataTable.Td align="right">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {canSubmit ? (
                            <Button variant="secondary" onClick={() => onSubmit(r.id)} disabled={busy}>
                              Submit
                            </Button>
                          ) : null}

                          {canApproveRow ? (
                            <>
                              <Button onClick={() => onApprove(r.id)} disabled={busy}>
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  setRejectingId(r.id);
                                  setRejectReason('');
                                  setError(null);
                                }}
                                disabled={busy}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </DataTable.Td>
                    </DataTable.Row>
                  );
                })}
              </DataTable.Body>
            </DataTable>
          ) : null}
        </div>
      </div>

      {rejectingId ? (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }}
            onClick={() => {
              if (busy) return;
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Reject Reclassification</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>A rejection reason is required.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                disabled={busy}
                style={{ width: '100%', borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (busy) return;
                  setRejectingId(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={onConfirmReject} disabled={busy}>
                {busy ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
