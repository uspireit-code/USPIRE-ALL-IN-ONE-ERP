import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Payment } from '../../services/payments';
import { listPayments } from '../../services/payments';
import { listInvoices as listArInvoices, type CustomerInvoice } from '../../services/ar';

type Row = Payment & { customerName?: string };

function formatMoney(n: number) {
  return Number(n).toFixed(2);
}

export function ArReceiptsListPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('PAYMENT_CREATE');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([listPayments(), listArInvoices()])
      .then(([payments, arInvoices]) => {
        if (!mounted) return;

        const invoiceById = new Map<string, CustomerInvoice>(arInvoices.map((i) => [i.id, i] as const));

        const filtered = payments
          .filter((p) => p.type === 'CUSTOMER_RECEIPT')
          .map((p) => {
            const firstAlloc = p.allocations[0];
            const inv = firstAlloc ? invoiceById.get(firstAlloc.sourceId) : undefined;
            return { ...p, customerName: inv?.customer?.name };
          });

        setRows(filtered);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load receipts';
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
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Bank Account</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.customerName ?? '-'}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.bankAccount?.name ?? p.bankAccountId}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(p.amount)}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/payments/ar/${p.id}`}>{p.status}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer Receipts</h2>
        {canCreate ? <Link to="/payments/ar/new">Create Customer Receipt</Link> : null}
      </div>
      {content}
    </div>
  );
}
