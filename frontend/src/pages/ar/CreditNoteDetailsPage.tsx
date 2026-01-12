import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import {
  approveCreditNote,
  getCreditNoteById,
  postCreditNote,
  submitCreditNote,
  voidCreditNote,
  type CreditNote,
} from '../../services/ar';

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

export function CreditNoteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canView = hasPermission('CREDIT_NOTE_VIEW') || hasPermission('CREDIT_NOTE_POST');
  const canSubmit = hasPermission('CREDIT_NOTE_CREATE');
  const canApprove = hasPermission('CREDIT_NOTE_APPROVE');
  const canPost = hasPermission('CREDIT_NOTE_POST');
  const canVoid = hasPermission('CREDIT_NOTE_VOID');

  const [cn, setCn] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    if (!id) return;
    const out = await getCreditNoteById(id);
    setCn(out);
  };

  useEffect(() => {
    if (!canView) return;
    if (!id) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getCreditNoteById(id)
      .then((data) => {
        if (!mounted) return;
        setCn(data);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load credit note'));
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
    const status = String(cn?.status ?? '').toUpperCase();
    return {
      submit: Boolean(cn) && status === 'DRAFT' && canSubmit,
      approve: Boolean(cn) && status === 'SUBMITTED' && canApprove,
      post: Boolean(cn) && status === 'APPROVED' && canPost,
      void: Boolean(cn) && status === 'POSTED' && canVoid,
    };
  }, [canApprove, canPost, canSubmit, canVoid, cn]);

  async function onSubmit() {
    if (!cn) return;
    const ok = window.confirm('Submit this credit note for approval?');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await submitCreditNote(cn.id, {});
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Submit failed'));
    } finally {
      setActing(false);
    }
  }

  async function onApprove() {
    if (!cn) return;
    const ok = window.confirm('Approve this credit note?');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await approveCreditNote(cn.id, {});
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Approve failed'));
    } finally {
      setActing(false);
    }
  }

  async function onPost() {
    if (!cn) return;
    const ok = window.confirm('Post this credit note? This action is irreversible.');
    if (!ok) return;

    setActing(true);
    setActionError(null);
    try {
      await postCreditNote(cn.id);
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Post failed'));
    } finally {
      setActing(false);
    }
  }

  async function onVoid() {
    if (!cn) return;
    const reason = window.prompt('Void reason (required):');
    if (!reason || reason.trim().length < 2) {
      setActionError('Void reason is required');
      return;
    }

    setActing(true);
    setActionError(null);
    try {
      await voidCreditNote(cn.id, reason);
      await refresh();
    } catch (e: any) {
      setActionError(getApiErrorMessage(e, 'Void failed'));
    } finally {
      setActing(false);
    }
  }

  if (!canView) {
    return (
      <div style={{ color: 'crimson' }}>
        You don’t have permission to view credit notes. Required: one of CREDIT_NOTE_VIEW, CREDIT_NOTE_POST.
      </div>
    );
  }
  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!cn) return <div style={{ color: 'crimson' }}>Credit note not found</div>;

  return (
    <PageLayout
      title={`Credit Note ${cn.creditNoteNumber}`}
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
          {allowed.void ? (
            <button type="button" disabled={acting} onClick={onVoid}>
              Void
            </button>
          ) : null}
          <button type="button" onClick={() => navigate('/finance/ar/credit-notes')}>
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
            <StatusBadge status={cn.status} />
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AuditRow label="Created By" value={cn.createdById ?? null} />
            <AuditRow label="Created At" value={cn.createdAt ?? null} />
            <AuditRow label="Approved By" value={cn.approvedById ?? null} />
            <AuditRow label="Approved At" value={cn.approvedAt ?? null} />
            <AuditRow label="Posted By" value={cn.postedById ?? null} />
            <AuditRow label="Posted At" value={cn.postedAt ?? null} />
            <AuditRow label="Voided By" value={cn.voidedById ?? null} />
            <AuditRow label="Voided At" value={cn.voidedAt ?? null} />
          </div>

          {cn.postedJournalId ? (
            <div style={{ marginTop: 12 }}>
              <b>Journal:</b> <Link to={`/finance/gl/journals/${cn.postedJournalId}`}>{cn.postedJournalId}</Link>
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 360, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ fontWeight: 700 }}>Original Invoice Summary</div>
          <div style={{ marginTop: 8 }}>
            <div>
              <b>Invoice:</b>{' '}
              {cn.invoiceId ? <Link to={`/finance/ar/invoices/${cn.invoiceId}`}>{cn.invoiceNumber ?? cn.invoiceId}</Link> : '-'}
            </div>
            <div>
              <b>Customer:</b> {cn.customerName ?? cn.customerId}
            </div>
            <div>
              <b>Credit Note Date:</b> {cn.creditNoteDate ?? '-'}
            </div>
            <div>
              <b>Memo:</b> {cn.memo ?? '-'}
            </div>
          </div>

          {cn.invoiceSummary ? (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Invoice Total</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(Number(cn.invoiceSummary.invoiceTotal ?? 0))}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Paid</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(Number(cn.invoiceSummary.paid ?? 0))}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Credited</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(Number(cn.invoiceSummary.credited ?? 0))}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Outstanding</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(Number(cn.invoiceSummary.outstanding ?? 0))}</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>Invoice summary unavailable.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Lines</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Revenue Account</th>
            </tr>
          </thead>
          <tbody>
            {(cn.lines ?? []).map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{Number(l.quantity ?? 0)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.unitPrice ?? 0))}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.lineAmount ?? 0))}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.revenueAccountCode ?? l.revenueAccountId}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontWeight: 700 }}>
          Total: {formatMoney(Number(cn.totalAmount ?? 0))}
        </div>
      </div>
    </PageLayout>
  );
}
