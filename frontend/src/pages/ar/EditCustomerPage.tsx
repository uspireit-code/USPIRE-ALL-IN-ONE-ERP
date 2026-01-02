import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Customer } from '../../services/ar';
import { getCustomerById, updateCustomer } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

export function EditCustomerPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canEdit = hasPermission('CUSTOMERS_EDIT');

  const [loaded, setLoaded] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        setLoaded(c);
        setName(c.name ?? '');
        setStatus(c.status ?? 'ACTIVE');
        setContactPerson(c.contactPerson ?? '');
        setEmail(c.email ?? '');
        setPhone(c.phone ?? '');
        setBillingAddress(c.billingAddress ?? '');
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canEdit) {
      setError('Permission denied');
      return;
    }

    const customerId = String(id ?? '').trim();
    if (!customerId) {
      setError('Missing customer id');
      return;
    }

    setError(null);

    const emailTrimmed = email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError('Invalid email format');
      return;
    }

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError('Customer Name is required');
      return;
    }

    setSaving(true);
    try {
      await updateCustomer(customerId, {
        name: nameTrimmed,
        status,
        contactPerson: contactPerson.trim() || undefined,
        email: emailTrimmed || undefined,
        phone: phone.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
      });

      navigate(`/finance/ar/customers/${customerId}`, { replace: true });
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update customer'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Edit Customer</h2>

      {!canEdit ? <div style={{ color: 'crimson' }}>You do not have permission to edit customers.</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Customer Code
          <input value={loaded?.customerCode ?? ''} disabled style={{ width: '100%' }} />
        </label>

        <label>
          Customer Name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%' }} />
        </label>

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
          <button type="submit" disabled={!canEdit || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate(`/finance/ar/customers/${id}`)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
