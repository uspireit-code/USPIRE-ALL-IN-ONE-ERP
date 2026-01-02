import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Customer } from '../../services/ar';
import { listCustomers } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

export function CustomersListPage() {
  const { hasPermission } = useAuth();
  const canCreateCustomer = hasPermission('CUSTOMERS_CREATE');

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listCustomers()
      .then((res) => {
        if (!mounted) return;
        setRows(res.items ?? []);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load customers'));
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

    if (rows.length === 0) {
      return <div style={{ color: '#666' }}>No customers found.</div>;
    }

    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/finance/ar/customers/${c.id}`}>{c.customerCode ?? '-'}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <Link to={`/finance/ar/customers/${c.id}`}>{c.name}</Link>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.status}</td>
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
        {canCreateCustomer ? <Link to="/finance/ar/customers/new">Create Customer</Link> : null}
      </div>

      {content}
    </div>
  );
}
