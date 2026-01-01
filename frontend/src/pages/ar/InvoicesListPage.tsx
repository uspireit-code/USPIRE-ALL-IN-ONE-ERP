import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { CustomerInvoice } from '../../services/ar';
import { listInvoices } from '../../services/ar';

function formatMoney(n: number) {
  return n.toFixed(2);
}

export function InvoicesListPage() {
  const { hasPermission } = useAuth();
  const canCreateInvoice = hasPermission('AR_INVOICE_CREATE');

  const [rows, setRows] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listInvoices()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load invoices';
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

  const content = useMemo(() => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Customer</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.customer?.name ?? '-'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/ar/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(inv.totalAmount)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer Invoices</h2>
        {canCreateInvoice ? <Link to="/ar/invoices/new">Create Invoice</Link> : null}
      </div>

      {content}
    </div>
  );
}
