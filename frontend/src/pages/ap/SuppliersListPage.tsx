import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Supplier } from '../../services/ap';
import { listSuppliers } from '../../services/ap';

export function SuppliersListPage() {
  const { hasPermission } = useAuth();
  const canCreateSupplier = hasPermission('AP_SUPPLIER_CREATE');

  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listSuppliers()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load suppliers';
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
          {rows.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.name}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Suppliers</h2>
        {canCreateSupplier ? <Link to="/ap/suppliers/new">Create Supplier</Link> : null}
      </div>

      {content}
    </div>
  );
}
