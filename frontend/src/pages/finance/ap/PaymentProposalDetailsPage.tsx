import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { Alert } from '../../../components/Alert';
import {
  approvePaymentProposal,
  getPaymentProposal,
  rejectPaymentProposal,
  submitPaymentProposal,
  updateDraftPaymentProposal,
  type PaymentProposal,
} from '../../../services/paymentProposals';

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function PaymentProposalDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useAuth();

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW);
  }, [state.me]);

  const canSubmit = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_SUBMIT);
  }, [state.me]);

  const canApprove = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_APPROVE);
  }, [state.me]);

  const canReject = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_REJECT);
  }, [state.me]);

  const userId = state.me?.user?.id;

  const [row, setRow] = useState<PaymentProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, id]);

  async function load() {
    const proposalId = String(id ?? '').trim();
    if (!proposalId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getPaymentProposal(proposalId);
      setRow(res);
    } catch (e) {
      setRow(null);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load proposal'));
    } finally {
      setLoading(false);
    }
  }

  const isCreator = useMemo(() => {
    if (!row?.createdById || !userId) return false;
    return row.createdById === userId;
  }, [row?.createdById, userId]);

  const canSubmitThis = Boolean(row && row.status === 'DRAFT' && isCreator && canSubmit);
  const canApproveThis = Boolean(row && row.status === 'SUBMITTED' && canApprove && !isCreator);
  const canRejectThis = Boolean(row && row.status === 'SUBMITTED' && canReject && !isCreator);

  const canEditDraft = Boolean(row && row.status === 'DRAFT' && isCreator);
  const [editing, setEditing] = useState(false);
  const [editProposalDate, setEditProposalDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLines, setEditLines] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!row) return;
    setEditProposalDate(String(row.proposalDate).slice(0, 10));
    setEditNotes(String(row.notes ?? ''));
    const next: Record<string, number> = {};
    for (const l of row.lines ?? []) next[l.invoiceId] = Number(l.proposedPayAmount ?? 0);
    setEditLines(next);
  }, [row?.id]);

  async function onSaveDraft() {
    if (!row) return;
    if (!canEditDraft) return;
    setActionLoading(true);
    setError('');
    try {
      const payload = {
        proposalDate: editProposalDate,
        notes: editNotes.trim() || undefined,
        lines: (row.lines ?? []).map((l) => ({
          invoiceId: l.invoiceId,
          proposedPayAmount: Number(editLines[l.invoiceId] ?? l.proposedPayAmount ?? 0),
        })),
      };
      const updated = await updateDraftPaymentProposal(row.id, payload);
      setRow(updated);
      setEditing(false);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to save draft'));
    } finally {
      setActionLoading(false);
    }
  }

  async function onConfirmReject() {
    if (!row) return;
    if (!canRejectThis) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await rejectPaymentProposal(row.id, { reason });
      navigate('/finance/ap/payment-proposals?flash=reject-success');
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to reject proposal'));
    } finally {
      setActionLoading(false);
      setShowReject(false);
      setRejectReason('');
    }
  }

  async function onSubmit() {
    if (!row) return;
    if (!canSubmitThis) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await submitPaymentProposal(row.id);
      setRow(updated);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to submit proposal'));
    } finally {
      setActionLoading(false);
    }
  }

  async function onApprove() {
    if (!row) return;
    if (!canApproveThis) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await approvePaymentProposal(row.id);
      setRow(updated);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to approve proposal'));
    } finally {
      setActionLoading(false);
    }
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Payment Proposal</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  if (loading && !row) {
    return <div style={{ padding: 18 }}>Loading…</div>;
  }

  if (!row) {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Payment Proposal</h2>
          <button
            type="button"
            onClick={() => navigate('/finance/ap/payment-proposals')}
            style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', background: 'white' }}
          >
            Back
          </button>
        </div>
        {error ? <div style={{ marginTop: 12, color: '#b00020' }}>{error}</div> : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            <Link to="/finance/ap/payment-proposals" style={{ color: '#1a4fd8', textDecoration: 'none' }}>
              Payment Proposals
            </Link>
            <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
            <span>{row.proposalNumber}</span>
          </div>
          <h2 style={{ margin: '6px 0 0 0' }}>{row.proposalNumber}</h2>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center' }}>
            <div>Proposal Date</div>
            <div>
              {editing && canEditDraft ? (
                <input
                  type="date"
                  value={editProposalDate}
                  onChange={(e) => setEditProposalDate(e.target.value)}
                  style={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
                />
              ) : (
                String(row.proposalDate).slice(0, 10)
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canEditDraft ? (
            editing ? (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void onSaveDraft()}
                  style={{ height: 38, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setEditing(false);
                    setEditProposalDate(String(row.proposalDate).slice(0, 10));
                    setEditNotes(String(row.notes ?? ''));
                    const next: Record<string, number> = {};
                    for (const l of row.lines ?? []) next[l.invoiceId] = Number(l.proposedPayAmount ?? 0);
                    setEditLines(next);
                  }}
                  style={{ height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', background: 'white' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setEditing(true)}
                style={{ height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', background: 'white' }}
              >
                Edit
              </button>
            )
          ) : null}

          {canSubmitThis ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void onSubmit()}
              style={{ height: 38, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
            >
              {actionLoading ? 'Submitting…' : 'Submit'}
            </button>
          ) : null}

          {canApproveThis ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void onApprove()}
              style={{ height: 38, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
            >
              {actionLoading ? 'Approving…' : 'Approve'}
            </button>
          ) : null}

          {canRejectThis ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowReject(true)}
              style={{ height: 38, padding: '0 14px', borderRadius: 8, border: 0, background: '#b00020', color: 'white' }}
            >
              Reject
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div style={{ marginTop: 12, color: '#b00020' }}>{error}</div> : null}

      {row.rejectedAt && row.rejectionReason ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="warning" title="This proposal was rejected">
            <div>
              <div>
                <b>Reason:</b> {row.rejectionReason}
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                <b>Rejected At:</b> {String(row.rejectedAt).slice(0, 19).replace('T', ' ')}
              </div>
            </div>
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Total Amount</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 750 }}>{money(row.totalAmount)}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Created By</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>{row.createdBy?.name || row.createdBy?.email || row.createdById}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Approved By</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>{row.approvedBy?.name || row.approvedBy?.email || (row.approvedById ?? '—')}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Approved At</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>{row.approvedAt ? String(row.approvedAt).slice(0, 19).replace('T', ' ') : '—'}</div>
        </div>
      </div>

      {row.notes ? (
        <div style={{ marginTop: 14, background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Notes</div>
          <div style={{ marginTop: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {editing && canEditDraft ? (
              <input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                style={{ height: 34, width: '100%', padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
              />
            ) : (
              row.notes
            )}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, overflowX: 'auto', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
          <thead>
            <tr style={{ background: 'rgba(2,4,69,0.05)' }}>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Supplier</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Invoice #</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Invoice Date</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Due Date</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Original</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Outstanding</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Proposed</th>
            </tr>
          </thead>
          <tbody>
            {(row.lines ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>
                  No lines.
                </td>
              </tr>
            ) : (
              (row.lines ?? []).map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: 12 }}>{l.supplierName}</td>
                  <td style={{ padding: 12 }}>{l.invoiceNumber}</td>
                  <td style={{ padding: 12 }}>{String(l.invoiceDate).slice(0, 10)}</td>
                  <td style={{ padding: 12 }}>{String(l.dueDate).slice(0, 10)}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>{money(Number(l.originalAmount))}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>{money(Number(l.outstandingAmount))}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    {editing && canEditDraft ? (
                      <input
                        value={String(editLines[l.invoiceId] ?? Number(l.proposedPayAmount))}
                        onChange={(e) =>
                          setEditLines((prev) => ({
                            ...prev,
                            [l.invoiceId]: Number(e.target.value),
                          }))
                        }
                        style={{ width: 140, textAlign: 'right' }}
                      />
                    ) : (
                      money(Number(l.proposedPayAmount))
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showReject ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,12,30,0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setShowReject(false);
          }}
        >
          <div style={{ width: 560, maxWidth: '96vw', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 750, fontSize: 16 }}>Reject Payment Proposal</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Provide a reason. This will be visible to the originator.</div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Reason</div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowReject(false)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirmReject()}
                disabled={actionLoading || !rejectReason.trim()}
                style={{ background: '#b00020', color: 'white', border: 0, padding: '6px 10px', borderRadius: 8 }}
              >
                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
