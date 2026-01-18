import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import type { SupplierInvoice } from '../../services/ap';
import { listBills } from '../../services/ap';
import { Alert } from '../../components/Alert';

function formatMoney(n: unknown) {
  const value = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

export function BillsListPage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewBills = hasPermission(PERMISSIONS.AP.INVOICE_VIEW);
  const canCreateBill = hasPermission(PERMISSIONS.AP.INVOICE_CREATE);

  const flash = searchParams.get('flash');

  const [rows, setRows] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listBills()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bills';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!canViewBills && !canCreateBill) {
    return <div>You do not have permission to access this page.</div>;
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bills</h2>
        {canCreateBill ? <Link to="/ap/bills/new">Create Bill</Link> : null}
      </div>

      {flash === 'reject-success' ? (
        <div style={{ marginTop: 12 }}>
          <Alert
            tone="success"
            title="Rejected successfully and returned to previous stage."
            actions={
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('flash');
                  setSearchParams(next);
                }}
              >
                Dismiss
              </button>
            }
          />
        </div>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Supplier</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Bill #</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((bill) => (
            <tr key={bill.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{bill.supplier?.name ?? '-'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/ap/bills/${bill.id}`}>{bill.invoiceNumber}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(bill.totalAmount)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{bill.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
