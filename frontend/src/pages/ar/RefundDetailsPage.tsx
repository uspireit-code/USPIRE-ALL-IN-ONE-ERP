import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { approveRefund, getRefundById, postRefund, submitRefund, type Refund } from '../../services/ar';

function StatusBadge(props: { status: string }) {
  const s = String(props.status ?? '').toUpperCase();
  const bg = s === 'POSTED' ? '#e6ffed' : s === 'VOID' ? '#ffecec' : s === 'APPROVED' ? '#e6f0ff' : '#fff7e6';
  const fg = s === 'POSTED' ? '#137333' : s === 'VOID' ? '#b00020' : s === 'APPROVED' ? '#1a4fb3' : '#7a4b00';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, background: bg, color: fg, fontSize: 12, fontWeight: 600 }}>
      {s}
    </span>
  );
}

function AuditRow(props: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ width: 130, opacity: 0.8 }}>{props.label}</div>
      <div style={{ fontFamily: 'monospace' }}>{props.value ?? '-'}</div>
    </div>
  );
}

export function RefundDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canView = hasPermission('REFUND_VIEW');
  const canSubmit = hasPermission('REFUND_SUBMIT');
  const canApprove = hasPermission('REFUND_APPROVE');
  const canPost = hasPermission('REFUND_POST');

  const [refund, setRefund] = useState<Refund | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    if (!id) return;
    const out = await getRefundById(id);
    setRefund(out);
  };

  useEffect(() => {
    if (!canView) return;
    if (!id) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getRefundById(id)
      .then((data) => {
        if (!mounted) return;
        setRefund(data);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load refund'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [canView, id]);

  const allowed = useMemo(() => {
    const status = String(refund?.status ?? '').toUpperCase();
    return {
      submit: Boolean(refund) && status === 'DRAFT' && canSubmit,
      approve: Boolean(refund) && status === 'SUBMITTED' && canApprove,
      post: Boolean(refund) && status === 'APPROVED' && canPost,
    };
  }, [canApprove, canPost, canSubmit, refund]);

  async function onSubmit() {
    if (!refund) return;
    const ok = window.confirm('Submit this refund?');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await submitRefund(refund.id);
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Submit failed'));
    } finally {
      setActing(false);
    }
  }

  async function onApprove() {
    if (!refund) return;
    const ok = window.confirm('Approve this refund?');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await approveRefund(refund.id);
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Approve failed'));
    } finally {
      setActing(false);
    }
  }

  async function onPost() {
    if (!refund) return;
    const ok = window.confirm('Post this refund? This action is irreversible.');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await postRefund(refund.id);
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Post failed'));
    } finally {
      setActing(false);
    }
  }

  if (!canView) return <div style={{ color: 'crimson' }}>You don’t have permission to view refunds. Required: REFUND_VIEW.</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!refund) return <div style={{ color: 'crimson' }}>Refund not found</div>;

  return (
    <PageLayout
      title={`Refund ${refund.refundNumber}`}
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allowed.submit ? (
            <button type="button" disabled={acting} onClick={onSubmit}>
              Submit
            </button>
          ) : null}
          {allowed.approve ? (
            <button type="button" disabled={acting} onClick={onApprove}>
              Approve
            </button>
          ) : null}
          {allowed.post ? (
            <button type="button" disabled={acting} onClick={onPost}>
              Post
            </button>
          ) : null}
          <button type="button" onClick={() => navigate('/finance/ar/refunds')}>
            Back
          </button>
        </div>
      }
    >
      {actionError ? <div style={{ color: 'crimson', marginBottom: 12 }}>{actionError}</div> : null}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 320, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Status</div>
            <StatusBadge status={refund.status} />
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AuditRow label="Created By" value={refund.createdById ?? null} />
            <AuditRow label="Created At" value={refund.createdAt ?? null} />
            <AuditRow label="Approved By" value={refund.approvedById ?? null} />
            <AuditRow label="Approved At" value={refund.approvedAt ?? null} />
            <AuditRow label="Posted By" value={refund.postedById ?? null} />
            <AuditRow label="Posted At" value={refund.postedAt ?? null} />
            <AuditRow label="Voided By" value={refund.voidedById ?? null} />
            <AuditRow label="Voided At" value={refund.voidedAt ?? null} />
          </div>

          {refund.postedJournalId ? (
            <div style={{ marginTop: 12 }}>
              <b>Journal:</b> <Link to={`/finance/gl/journals/${refund.postedJournalId}`}>{refund.postedJournalId}</Link>
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 360, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ fontWeight: 700 }}>Credit Note Summary</div>
          <div style={{ marginTop: 8 }}>
            <div>
              <b>Credit Note:</b>{' '}
              <Link to={`/finance/ar/credit-notes/${refund.creditNoteId}`}>{refund.creditNoteNumber ?? refund.creditNoteId}</Link>
            </div>
            <div>
              <b>Invoice:</b>{' '}
              {refund.invoiceId ? <Link to={`/finance/ar/invoices/${refund.invoiceId}`}>{refund.invoiceId}</Link> : '-'}
            </div>
            <div>
              <b>Customer:</b> {refund.customerName ?? refund.customerId}
            </div>
            <div>
              <b>Credit Note Date:</b> {refund.creditNoteDate ?? '-'}
            </div>
            <div>
              <b>Credit Note Total:</b> {formatMoney(Number(refund.creditNoteTotalAmount ?? 0))}
            </div>
          </div>

          <div style={{ marginTop: 12, fontWeight: 700 }}>Payment Details</div>
          <div style={{ marginTop: 8 }}>
            <div>
              <b>Method:</b> {refund.paymentMethod}
            </div>
            <div>
              <b>Bank Account:</b> {refund.bankAccountId ?? '-'}
            </div>
            <div>
              <b>Refund Date:</b> {refund.refundDate ?? '-'}
            </div>
            <div>
              <b>Amount:</b> {formatMoney(Number(refund.amount ?? 0))}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
