import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { createSupplier } from '../../services/ap';

export function CreateSupplierPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreateSupplier = hasPermission('AP_SUPPLIER_CREATE');

  const [name, setName] = useState('');
  const [status] = useState<'ACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canCreateSupplier) {
      setError('Permission denied');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await createSupplier({ name });
      navigate('/ap/suppliers', { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create supplier';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Create Supplier</h2>

      {!canCreateSupplier ? <div style={{ color: 'crimson' }}>You do not have permission to create suppliers.</div> : null}

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
          <button type="submit" disabled={!canCreateSupplier || loading}>
            {loading ? 'Saving...' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/ap/suppliers')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
