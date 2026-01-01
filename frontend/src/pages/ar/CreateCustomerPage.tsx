import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { createCustomer } from '../../services/ar';

export function CreateCustomerPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreateCustomer = hasPermission('AR_CUSTOMER_CREATE');

  const [name, setName] = useState('');
  const [status] = useState<'ACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canCreateCustomer) {
      setError('Permission denied');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await createCustomer({ name });
      navigate('/ar/customers', { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create customer';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Create Customer</h2>

      {!canCreateCustomer ? <div style={{ color: 'crimson' }}>You do not have permission to create customers.</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%' }} />
        </label>

        <label>
          Status
          <input value={status} disabled style={{ width: '100%' }} />
        </label>

        {error ? <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreateCustomer || loading}>
            {loading ? 'Saving...' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/ar/customers')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
