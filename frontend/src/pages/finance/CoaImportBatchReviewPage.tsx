import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import {
  approveCoaImportBatch,
  rejectCoaImportBatch,
  reviewCoaImportBatch,
  type CoaImportBatchReviewResponse,
} from '../../services/coa';

function formatDateTime(v: any) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function readinessTone(v: any) {
  const s = String(v ?? '').toUpperCase();
  if (s === 'READY') return { bg: '#e7f6ec', fg: '#166534', border: '#bbf7d0' };
  if (s === 'INCOMPLETE') return { bg: '#fff7ed', fg: '#9a3412', border: '#fed7aa' };
  return { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' };
}

export function CoaImportBatchReviewPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canApprove = hasPermission(PERMISSIONS.COA.APPROVE);
  const canReject = hasPermission(PERMISSIONS.COA.REJECT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [data, setData] = useState<CoaImportBatchReviewResponse | null>(null);

  const [filter, setFilter] = useState<'ALL' | 'READY' | 'INCOMPLETE' | 'ERROR'>('ALL');
  const [search, setSearch] = useState('');

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [comment, setComment] = useState('');
  const [approveConfirming, setApproveConfirming] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const review = useMemo(() => data ?? null, [data]);

  const realUserId = state.me?.delegation?.realUserId ?? state.me?.user?.id ?? '';
  const requestedById = String((review as any)?.batch?.submittedByUserId ?? (review as any)?.batch?.createdByUserId ?? '');
  const isSelfApprovalAttempt = Boolean(realUserId) && Boolean(requestedById) && String(realUserId) === String(requestedById);

  async function refresh() {
    const bid = String(batchId ?? '').trim();
    if (!bid) {
      setError('Missing batchId');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await reviewCoaImportBatch(bid);
      setData(res);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load batch review'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, batchId]);

  const accounts = (review as any)?.accounts ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts as any[])
      .filter((a) => {
        if (filter === 'ALL') return true;
        return String((a as any)?.readiness ?? '').toUpperCase() === filter;
      })
      .filter((a) => {
        if (!q) return true;
        const code = String((a as any)?.code ?? '').toLowerCase();
        const name = String((a as any)?.name ?? '').toLowerCase();
        const parent = String((a as any)?.parentLabel ?? '').toLowerCase();
        return code.includes(q) || name.includes(q) || parent.includes(q);
      });
  }, [accounts, filter, search]);

  const selectedAccount = useMemo(
    () => (accounts as any[]).find((a) => String((a as any)?.id) === String(selectedAccountId ?? '')) ?? null,
    [accounts, selectedAccountId],
  );

  async function onConfirmApprove() {
    const bid = String(batchId ?? '').trim();
    if (!bid) return;
    if (!canApprove) return;
    if (isSelfApprovalAttempt) return;

    setApproveBusy(true);
    setError(null);
    try {
      await approveCoaImportBatch(bid, { comment: comment.trim() || undefined });
      setToast('Batch approved');
      window.setTimeout(() => setToast(null), 2500);
      setApproveConfirming(false);
      setComment('');
      await refresh();
      navigate('/finance/coa/approvals');
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to approve batch'));
    } finally {
      setApproveBusy(false);
    }
  }

  async function onConfirmReject() {
    const bid = String(batchId ?? '').trim();
    if (!bid) return;
    if (!canReject) return;
    if (isSelfApprovalAttempt) return;

    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required.');
      return;
    }

    setRejectBusy(true);
    setError(null);
    try {
      await rejectCoaImportBatch(bid, { rejectionReason: reason });
      setToast('Batch rejected');
      window.setTimeout(() => setToast(null), 2500);
      setRejecting(false);
      setRejectReason('');
      await refresh();
      navigate('/finance/coa/approvals');
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to reject batch'));
    } finally {
      setRejectBusy(false);
    }
  }

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canApprove) {
    return (
      <div>
        <h2>COA Batch Review</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to review COA import batches.
          </Alert>
        </div>
      </div>
    );
  }

  const batch = (review as any)?.batch ?? null;
  const summary = (review as any)?.summary ?? null;
  const readiness = (review as any)?.readiness ?? null;
  const freeze = readiness?.freezeLock ?? { coaFrozen: false, coaLockedAt: null };

  const statusLabel = String(batch?.status ?? '').replaceAll('_', ' ');
  const readinessLabel = String(readiness?.validationStatus ?? '—');
  const rt = readinessTone(readinessLabel);

  const actionsDisabled =
    !batch ||
    String(batch?.status ?? '') !== 'PENDING_APPROVAL' ||
    Boolean(freeze?.coaFrozen) ||
    Boolean(freeze?.coaLockedAt) ||
    String(readiness?.validationStatus ?? '').toUpperCase() !== 'READY' ||
    Boolean(readiness?.hasErrors) ||
    isSelfApprovalAttempt;

  return (
    <div className="financePage" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            maxWidth: 1100,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 850 }}>COA Import Batch Review</div>
          <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
            <Link to="/finance/coa/approvals" style={{ color: tokens.brandHex.navy, textDecoration: 'none', fontWeight: 700 }}>
              Back to Approvals
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={refresh} disabled={loading || approveBusy || rejectBusy}>
            Refresh
          </Button>
          <Button
            onClick={() => setApproveConfirming(true)}
            disabled={!canApprove || approveBusy || rejectBusy || actionsDisabled}
          >
            {approveBusy ? 'Approving…' : 'Approve Batch'}
          </Button>
          {canReject ? (
            <Button
              variant="destructive"
              onClick={() => setRejecting(true)}
              disabled={rejectBusy || approveBusy || actionsDisabled}
            >
              {rejectBusy ? 'Rejecting…' : 'Reject Batch'}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Error">
          <div>{error}</div>
        </Alert>
      ) : null}

      {loading ? <div style={{ color: tokens.colors.text.muted }}>Loading…</div> : null}

      {batch ? (
        <div
          style={{
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: 16,
            background: '#fff',
            padding: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontWeight: 850, fontSize: 16 }}>Batch {batch.batchId}</div>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${rt.border}`,
                background: rt.bg,
                color: rt.fg,
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Readiness: {readinessLabel}
            </div>
            <div style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${tokens.colors.border.subtle}`, background: '#f8fafc', fontWeight: 750, fontSize: 12 }}>
              Status: {statusLabel || '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Source File</div>
            <div style={{ fontWeight: 650 }}>{String(batch?.sourceFileName ?? '').trim() || '—'}</div>

            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Created At</div>
            <div style={{ fontWeight: 650 }}>{formatDateTime(batch.createdAt)}</div>

            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Submitted At</div>
            <div style={{ fontWeight: 650 }}>{formatDateTime(batch.submittedAt)}</div>

            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Approved At</div>
            <div style={{ fontWeight: 650 }}>{formatDateTime(batch.approvedAt)}</div>

            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Reviewed At</div>
            <div style={{ fontWeight: 650 }}>{formatDateTime((batch as any)?.reviewedAt)}</div>

            <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Account Count</div>
            <div style={{ fontWeight: 650 }}>{batch.accountCount}</div>
          </div>

          {freeze?.coaFrozen || freeze?.coaLockedAt ? (
            <div style={{ marginTop: 2 }}>
              <Alert tone="warning" title="COA Locked">
                {freeze?.coaFrozen ? <div>COA is frozen.</div> : null}
                {freeze?.coaLockedAt ? <div>COA is locked since {formatDateTime(freeze.coaLockedAt)}.</div> : null}
              </Alert>
            </div>
          ) : null}

          {isSelfApprovalAttempt ? (
            <div style={{ marginTop: 2 }}>
              <Alert tone="warning" title="Self-approval blocked">
                You cannot approve/reject a batch you submitted.
              </Alert>
            </div>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'Total Accounts', value: summary.totalAccounts },
            { label: 'Posting Accounts', value: summary.postingAccounts },
            { label: 'Parent Accounts', value: summary.parentAccounts },
            { label: 'Root Categories', value: summary.rootCategoriesAffected },
            { label: 'IFRS Mappings', value: summary.ifrsMappings },
            { label: 'Unmapped', value: summary.unmappedAccounts },
          ].map((x) => (
            <div key={x.label} style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 16, background: '#fff', padding: 12 }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 750 }}>{x.label}</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{String(x.value ?? '—')}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          border: `1px solid ${tokens.colors.border.subtle}`,
          borderRadius: 16,
          background: '#fff',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontWeight: 850 }}>Accounts</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code/name/parent"
              style={{
                height: 36,
                padding: '0 10px',
                borderRadius: 12,
                border: `1px solid ${tokens.colors.border.default}`,
                fontSize: 13,
                minWidth: 260,
              }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                height: 36,
                padding: '0 10px',
                borderRadius: 12,
                border: `1px solid ${tokens.colors.border.default}`,
                fontSize: 13,
              }}
            >
              <option value="ALL">All</option>
              <option value="READY">Ready</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="ERROR">Error</option>
            </select>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 650 }}>{filtered.length} rows</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <DataTable>
            <DataTable.Head>
              <tr>
                <DataTable.Th>Code</DataTable.Th>
                <DataTable.Th>Name</DataTable.Th>
                <DataTable.Th>Parent</DataTable.Th>
                <DataTable.Th>Type</DataTable.Th>
                <DataTable.Th>IFRS</DataTable.Th>
                <DataTable.Th>Readiness</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {filtered.length === 0 ? <DataTable.Empty colSpan={6} title="No accounts match your filter." /> : null}
              {filtered.map((a: any, idx: number) => {
                const isSelected = String(selectedAccountId ?? '') === String(a.id);
                const rr = readinessTone(a.readiness);
                return (
                  <DataTable.Row
                    key={a.id}
                    zebra
                    index={idx}
                    onClick={() => setSelectedAccountId(String(a.id))}
                    selected={isSelected}
                    style={{ cursor: 'pointer', background: isSelected ? 'rgba(11, 11, 71, 0.05)' : undefined }}
                  >
                    <DataTable.Td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>
                      {a.code}
                    </DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12 }}>{a.name}</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{a.parentLabel || 'Root'}</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12 }}>{String(a.type ?? '—')}</DataTable.Td>
                    <DataTable.Td style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                      {a.ifrsNode ? String(a.ifrsNode.name ?? '') : a.ifrsNodeId ? String(a.ifrsNodeId) : '—'}
                    </DataTable.Td>
                    <DataTable.Td>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          border: `1px solid ${rr.border}`,
                          background: rr.bg,
                          color: rr.fg,
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {String(a.readiness ?? '—')}
                      </span>
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable>
        </div>
      </div>

      {selectedAccount ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }} onClick={() => setSelectedAccountId(null)} />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100vh',
              width: 'min(560px, calc(100vw - 24px))',
              background: '#fff',
              borderLeft: `1px solid ${tokens.colors.border.subtle}`,
              zIndex: 71,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedAccount.code} - {selectedAccount.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>Read-only preview</div>
              </div>
              <Button variant="secondary" onClick={() => setSelectedAccountId(null)} style={{ height: 36 }}>
                Close
              </Button>
            </div>

            <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 12, background: '#f8fafc', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
                Details
              </div>
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Account Code</div>
                <div style={{ fontWeight: 650 }}>{selectedAccount.code}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Account Name</div>
                <div style={{ fontWeight: 650 }}>{selectedAccount.name}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Type</div>
                <div style={{ fontWeight: 650 }}>{String((selectedAccount as any).type ?? '—')}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Parent</div>
                <div style={{ fontWeight: 650 }}>{(selectedAccount as any).parentLabel || 'Root'}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>IFRS Node</div>
                <div style={{ fontWeight: 650 }}>
                  {(selectedAccount as any).ifrsNode
                    ? `${String((selectedAccount as any).ifrsNode.statement ?? '')} - ${String((selectedAccount as any).ifrsNode.name ?? '')}`.trim()
                    : String((selectedAccount as any).ifrsNodeId ?? '').trim() || '—'}
                </div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Status</div>
                <div style={{ fontWeight: 650 }}>{String((selectedAccount as any).status ?? '—')}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Readiness</div>
                <div style={{ fontWeight: 650 }}>{String((selectedAccount as any).readiness ?? '—')}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Issues</div>
                <div style={{ fontWeight: 650 }}>
                  {Array.isArray((selectedAccount as any).issues) && (selectedAccount as any).issues.length > 0
                    ? (selectedAccount as any).issues.map((i: any, idx: number) => (
                        <div key={idx} style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                          - {String(i?.message ?? i?.field ?? '')}
                        </div>
                      ))
                    : '—'}
                </div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Message</div>
                <div style={{ fontWeight: 650, color: tokens.colors.text.secondary }}>{String((selectedAccount as any).message ?? '').trim() || '—'}</div>

                <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Description</div>
                <div style={{ fontWeight: 650, color: tokens.colors.text.secondary }}>{String((selectedAccount as any).description ?? '').trim() || '—'}</div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {approveConfirming ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }} onClick={() => setApproveConfirming(false)} />
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Approve Batch</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>Approving this batch will activate all accounts in the batch.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Comment (optional)
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={approveBusy || actionsDisabled}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 12px',
                  borderRadius: tokens.radius.sm,
                  border: `1px solid ${tokens.colors.border.default}`,
                  background: tokens.colors.white,
                  color: tokens.colors.text.primary,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  opacity: approveBusy ? 0.6 : 1,
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setApproveConfirming(false)} disabled={approveBusy}>
                Cancel
              </Button>
              <Button onClick={onConfirmApprove} disabled={approveBusy || actionsDisabled}>
                {approveBusy ? 'Approving…' : 'Approve Batch'}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {rejecting ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }} onClick={() => setRejecting(false)} />
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Reject Batch</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>A rejection reason is required.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                disabled={rejectBusy || actionsDisabled}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  padding: 10,
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setRejecting(false)} disabled={rejectBusy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onConfirmReject} disabled={rejectBusy || actionsDisabled}>
                {rejectBusy ? 'Rejecting…' : 'Reject Batch'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
