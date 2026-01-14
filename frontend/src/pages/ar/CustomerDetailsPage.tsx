import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { Customer } from '../../services/ar';
import { getCustomerById } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

export function CustomerDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canEdit = hasPermission(PERMISSIONS.AR.CUSTOMERS.EDIT);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const customerId = String(id ?? '').trim();
    if (!customerId) {
      setError('Missing customer id');
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getCustomerById(customerId)
      .then((c) => {
        if (!mounted) return;
        setCustomer(c);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setError(getApiErrorMessage(e, 'Failed to load customer'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const content = useMemo(() => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
    if (!customer) return <div style={{ color: '#666' }}>Customer not found.</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Customer Code</div>
          <div>{customer.customerCode ?? '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Customer Name</div>
          <div>{customer.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Status</div>
          <div>{customer.status}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Contact Person</div>
          <div>{customer.contactPerson ?? '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Email</div>
          <div>{customer.email ?? '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Phone</div>
          <div>{customer.phone ?? '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Billing Address</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{customer.billingAddress ?? '-'}</div>
        </div>
      </div>
    );
  }, [customer, error, loading]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Customer</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/finance/ar/customers">Back to list</Link>
          {canEdit && id ? <Link to={`/finance/ar/customers/${id}/edit`}>Edit</Link> : null}
        </div>
      </div>

      {content}
    </div>
  );
}
