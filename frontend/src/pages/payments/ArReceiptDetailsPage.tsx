import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { Payment } from '../../services/payments';
import { approvePayment, listPayments, postPayment } from '../../services/payments';
import { listInvoices as listArInvoices, type CustomerInvoice } from '../../services/ar';

function formatMoney(n: number) {
  return Number(n).toFixed(2);
}

export function ArReceiptDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canApprove = hasPermission(PERMISSIONS.PAYMENT.APPROVE);
  const canPost = hasPermission(PERMISSIONS.PAYMENT.POST);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([listPayments(), listArInvoices()])
      .then(([payments, invoices]) => {
        if (!mounted) return;
        const p = payments.find((x) => x.id === id && x.type === 'CUSTOMER_RECEIPT') ?? null;
        setPayment(p);
        if (!p) {
          setError('Receipt not found');
          return;
        }

        const byId = new Map<string, CustomerInvoice>((invoices.items ?? []).map((i) => [i.id, i] as const));
        const first = p.allocations[0];
        const inv = first ? byId.get(first.sourceId) : undefined;
        setCustomerName(inv?.customer?.name ?? null);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load receipt';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const allowed = useMemo(() => {
    const status = payment?.status;
    return {
      approve: Boolean(payment) && status === 'DRAFT' && canApprove,
      post: Boolean(payment) && status === 'APPROVED' && canPost,
    };
  }, [canApprove, canPost, payment]);

  async function runAction(kind: 'approve' | 'post') {
    if (!payment) return;

    setActionError(null);
    setActing(true);
    try {
      if (kind === 'approve') {
        const updated = await approvePayment(payment.id);
        setPayment(updated);
      } else {
        const result = await postPayment(payment.id);
        if (result?.payment) {
          setPayment(result.payment);
        } else {
          const refreshed = await listPayments();
          setPayment(refreshed.find((x) => x.id === payment.id) ?? payment);
        }
      }
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Action failed';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!payment) return <div style={{ color: 'crimson' }}>Receipt not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer Receipt</h2>
        <Link to="/payments/ar">Back to list</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Customer:</b> {customerName ?? '-'}
        </div>
        <div>
          <b>Bank Account:</b> {payment.bankAccount?.name ?? payment.bankAccountId}
        </div>
        <div>
          <b>Receipt Date:</b> {payment.paymentDate?.slice(0, 10)}
        </div>
        <div>
          <b>Status:</b> {payment.status}
        </div>
        <div>
          <b>Amount:</b> {formatMoney(payment.amount)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => runAction('approve')} disabled={!allowed.approve || acting}>
          Submit/Approve
        </button>
        <button onClick={() => runAction('post')} disabled={!allowed.post || acting}>
          Post
        </button>
      </div>

      {actionError ? <div style={{ color: 'crimson', marginTop: 12 }}>{actionError}</div> : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Allocations</div>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Source</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations.map((a) => (
              <tr key={a.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.sourceType} {a.sourceId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(a.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {payment.status === 'POSTED' ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This receipt is POSTED and cannot be edited.</div> : null}
      </div>
    </div>
  );
}
