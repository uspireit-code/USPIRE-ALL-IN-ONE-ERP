import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Customer } from '../../services/ar';
import { listCustomers } from '../../services/ar';

export function CustomersListPage() {
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission('AR_CUSTOMER_CREATE');

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listCustomers()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load customers';
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
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customers</h2>
        {canCreateCustomer ? <Link to="/ar/customers/new">Create Customer</Link> : null}
      </div>

      {content}
    </div>
  );
}
