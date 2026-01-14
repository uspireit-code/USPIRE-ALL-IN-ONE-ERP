import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { createCustomer } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

export function CreateCustomerPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreateCustomer = hasPermission(PERMISSIONS.AR.CUSTOMERS.CREATE);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canCreateCustomer) {
      setError('Permission denied');
      return;
    }

    setError(null);

    const nextErrors: { name?: string; email?: string } = {};
    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();
    if (!nameTrimmed) nextErrors.name = 'Customer Name is required';
    if (!emailTrimmed) nextErrors.email = 'Email is required';
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) nextErrors.email = 'Invalid email format';
    setFieldErrors(nextErrors);
    if (nextErrors.name || nextErrors.email) return;

    setLoading(true);
    try {
      const created = await createCustomer({
        name: nameTrimmed,
        status,
        contactPerson: contactPerson.trim() || undefined,
        email: emailTrimmed,
        phone: phone.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
      });
      navigate(`/finance/ar/customers/${created.id}`, { replace: true });
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to create customer'));
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
          Customer Code
          <input value={''} disabled placeholder="(auto-generated)" style={{ width: '100%' }} />
        </label>

        <label>
          Customer Name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%' }} />
        </label>
        {fieldErrors.name ? <div style={{ color: 'crimson', fontSize: 13 }}>{fieldErrors.name}</div> : null}

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ width: '100%' }}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>

        <label>
          Contact Person
          <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ width: '100%' }} />
        </label>
        {fieldErrors.email ? <div style={{ color: 'crimson', fontSize: 13 }}>{fieldErrors.email}</div> : null}

        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Billing Address
          <textarea value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} rows={4} style={{ width: '100%' }} />
        </label>

        {error ? <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreateCustomer || loading}>
            {loading ? 'Saving...' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/finance/ar/customers')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
