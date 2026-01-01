import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { CustomerInvoice } from '../../services/ar';
import { approveInvoice, listInvoices, postInvoice, submitInvoice } from '../../services/ar';

function formatMoney(n: number) {
  return n.toFixed(2);
}

export function InvoiceDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canSubmit = hasPermission('AR_INVOICE_SUBMIT');
  const canApprove = hasPermission('AR_INVOICE_APPROVE');
  const canPost = hasPermission('AR_INVOICE_POST');

  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listInvoices()
      .then((rows) => {
        if (!mounted) return;
        const found = rows.find((r) => r.id === id) ?? null;
        setInvoice(found);
        if (!found) setError('Invoice not found');
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load invoice';
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
    const status = invoice?.status;
    return {
      submit: Boolean(invoice) && status === 'DRAFT' && canSubmit,
      approve: Boolean(invoice) && status === 'SUBMITTED' && canApprove,
      post: Boolean(invoice) && status === 'APPROVED' && canPost,
    };
  }, [canApprove, canPost, canSubmit, invoice]);

  async function runAction(kind: 'submit' | 'approve' | 'post') {
    if (!invoice) return;

    setActionError(null);
    setActing(true);
    try {
      if (kind === 'submit') {
        const updated = await submitInvoice(invoice.id);
        setInvoice(updated);
      } else if (kind === 'approve') {
        const updated = await approveInvoice(invoice.id);
        setInvoice(updated);
      } else {
        const result = await postInvoice(invoice.id);
        if (result?.invoice) {
          setInvoice(result.invoice);
        } else {
          const refreshed = await listInvoices();
          setInvoice(refreshed.find((r) => r.id === invoice.id) ?? invoice);
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
  if (!invoice) return <div style={{ color: 'crimson' }}>Invoice not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Invoice {invoice.invoiceNumber}</h2>
        <Link to="/ar/invoices">Back to list</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Customer:</b> {invoice.customer?.name ?? '-'}
        </div>
        <div>
          <b>Invoice Date:</b> {invoice.invoiceDate?.slice(0, 10)}
        </div>
        <div>
          <b>Due Date:</b> {invoice.dueDate?.slice(0, 10)}
        </div>
        <div>
          <b>Status:</b> {invoice.status}
        </div>
        <div>
          <b>Total:</b> {formatMoney(invoice.totalAmount)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => runAction('submit')} disabled={!allowed.submit || acting}>
          Submit
        </button>
        <button onClick={() => runAction('approve')} disabled={!allowed.approve || acting}>
          Approve
        </button>
        <button onClick={() => runAction('post')} disabled={!allowed.post || acting}>
          Post
        </button>
      </div>

      {actionError ? <div style={{ color: 'crimson', marginTop: 12 }}>{actionError}</div> : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Lines</div>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {invoice.status === 'POSTED' ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This invoice is POSTED and cannot be edited.</div> : null}
      </div>
    </div>
  );
}
