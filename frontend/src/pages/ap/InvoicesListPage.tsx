import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { SupplierInvoice } from '../../services/ap';
import { listInvoices } from '../../services/ap';

function formatMoney(n: unknown) {
  const value = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN;
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

export function InvoicesListPage() {
  const { hasPermission } = useAuth();
  const canCreateInvoice = hasPermission(PERMISSIONS.AP.INVOICE.CREATE);

  const [rows, setRows] = useState<SupplierInvoice[]>([]);
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
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Supplier</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Total</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.supplier?.name ?? '-'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/ap/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
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
        <h2>Supplier Invoices</h2>
        {canCreateInvoice ? <Link to="/ap/invoices/new">Create Invoice</Link> : null}
      </div>

      {content}
    </div>
  );
}
