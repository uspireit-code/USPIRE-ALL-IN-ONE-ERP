import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { Payment } from '../../services/payments';
import { approvePayment, listPayments, postPayment, updatePayment } from '../../services/payments';
import { listInvoices as listApInvoices, type SupplierInvoice } from '../../services/ap';
import { ApPaymentForm } from './ApPaymentForm';

function formatMoney(n: number) {
  return Number(n).toFixed(2);
}

export function ApPaymentDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canApprove = hasPermission(PERMISSIONS.PAYMENT.APPROVE);
  const canPost = hasPermission(PERMISSIONS.PAYMENT.POST);

  const [payment, setPayment] = useState<Payment | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([listPayments(), listApInvoices()])
      .then(([payments, invoices]) => {
        if (!mounted) return;
        const p = payments.find((x) => x.id === id && x.type === 'SUPPLIER_PAYMENT') ?? null;
        setPayment(p);
        if (!p) {
          setError('Payment not found');
          return;
        }

        const byId = new Map<string, SupplierInvoice>(invoices.map((i) => [i.id, i] as const));
        const first = p.allocations[0];
        const inv = first ? byId.get(first.sourceId) : undefined;
        setSupplierName(inv?.supplier?.name ?? null);

        if ((p?.status ?? '') !== 'DRAFT') {
          setEditing(false);
        }
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load payment';
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

  const canEdit = useMemo(() => {
    return Boolean(payment) && payment?.status === 'DRAFT' && hasPermission(PERMISSIONS.PAYMENT.CREATE);
  }, [hasPermission, payment]);

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
  if (!payment) return <div style={{ color: 'crimson' }}>Payment not found</div>;

  if (editing && canEdit) {
    return (
      <ApPaymentForm
        title="Edit Supplier Payment"
        submitLabel="Save Changes"
        initialPayment={payment}
        onSubmit={async (params) => {
          if (!id) throw new Error('Missing payment id');
          return updatePayment(id, {
            bankAccountId: params.bankAccountId,
            amount: params.amount,
            paymentDate: params.paymentDate,
            reference: params.reference,
            allocations: params.allocations,
          });
        }}
        onSubmitted={(p) => {
          setPayment(p);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Supplier Payment</h2>
        <Link to="/payments/ap">Back to list</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Supplier:</b> {supplierName ?? '-'}
        </div>
        <div>
          <b>Bank Account:</b> {payment.bankAccount?.name ?? payment.bankAccountId}
        </div>
        <div>
          <b>Payment Date:</b> {payment.paymentDate?.slice(0, 10)}
        </div>
        <div>
          <b>Status:</b> {payment.status}
        </div>
        <div>
          <b>Amount:</b> {formatMoney(payment.amount)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        {canEdit ? (
          <button onClick={() => setEditing(true)} disabled={acting}>
            Edit
          </button>
        ) : null}
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

        {payment.status === 'POSTED' ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This payment is POSTED and cannot be edited.</div> : null}
      </div>
    </div>
  );
}
