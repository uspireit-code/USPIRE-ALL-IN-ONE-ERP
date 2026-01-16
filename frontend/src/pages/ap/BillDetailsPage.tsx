import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import type { SupplierInvoice } from '../../services/ap';
import { approveBill, listBills, postBill, submitBill } from '../../services/ap';

function formatMoney(n: unknown) {
  const value = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

export function BillDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.AP.INVOICE_VIEW);
  const canCreate = hasPermission(PERMISSIONS.AP.INVOICE_CREATE);
  const canSubmit = hasPermission(PERMISSIONS.AP.INVOICE_SUBMIT);
  const canApprove = hasPermission(PERMISSIONS.AP.INVOICE_APPROVE);
  const canPost = hasPermission(PERMISSIONS.AP.INVOICE_POST);

  const canConfigureApControlAccount =
    hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);

  const [bill, setBill] = useState<SupplierInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listBills()
      .then((rows) => {
        if (!mounted) return;
        const found = rows.find((r) => r.id === id) ?? null;
        setBill(found);
        if (!found) setError('Bill not found');
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bill';
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
    const status = bill?.status;
    return {
      submit: Boolean(bill) && status === 'DRAFT' && canSubmit,
      approve: Boolean(bill) && status === 'SUBMITTED' && canApprove,
      post: Boolean(bill) && status === 'APPROVED' && canPost,
    };
  }, [bill, canApprove, canPost, canSubmit]);

  async function runAction(kind: 'submit' | 'approve' | 'post') {
    if (!bill) return;

    setActionError(null);
    setActing(true);
    try {
      if (kind === 'submit') {
        const updated = await submitBill(bill.id);
        setBill(updated);
      } else if (kind === 'approve') {
        const updated = await approveBill(bill.id);
        setBill(updated);
      } else {
        const result = await postBill(bill.id);
        if (result?.invoice) {
          setBill(result.invoice);
        } else {
          const refreshed = await listBills();
          setBill(refreshed.find((r) => r.id === bill.id) ?? bill);
        }
      }
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Action failed';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  if (!canView && !canCreate) return <div>You do not have permission to access this page.</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!bill) return <div style={{ color: 'crimson' }}>Bill not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bill {bill.invoiceNumber}</h2>
        <Link to="/ap/bills">Back to list</Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Supplier:</b> {bill.supplier?.name ?? '-'}
        </div>
        <div>
          <b>Bill Date:</b> {bill.invoiceDate?.slice(0, 10)}
        </div>
        <div>
          <b>Due Date:</b> {bill.dueDate?.slice(0, 10)}
        </div>
        <div>
          <b>Status:</b> {bill.status}
        </div>
        <div>
          <b>Total:</b> {formatMoney(bill.totalAmount)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        {canSubmit ? (
          <button onClick={() => runAction('submit')} disabled={!allowed.submit || acting}>
            Submit
          </button>
        ) : null}
        {canApprove ? (
          <button onClick={() => runAction('approve')} disabled={!allowed.approve || acting}>
            Approve
          </button>
        ) : null}
        {canPost ? (
          <button onClick={() => runAction('post')} disabled={!allowed.post || acting}>
            Post
          </button>
        ) : null}
      </div>

      {actionError ? (
        <div style={{ color: 'crimson', marginTop: 12 }}>
          <div>{actionError}</div>
          {canConfigureApControlAccount &&
          actionError.includes('AP control account is not configured') ? (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <Link to="/settings/finance/control-accounts">
                Go to Settings → Finance → Control Accounts
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

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
            {bill.lines.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {bill.status === 'POSTED' ? (
          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
            This bill is POSTED and cannot be edited.
          </div>
        ) : null}
      </div>
    </div>
  );
}
