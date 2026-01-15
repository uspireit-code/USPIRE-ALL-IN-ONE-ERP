import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { createSupplier } from '../../services/ap';

export function CreateSupplierPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreateSupplier = hasPermission(PERMISSIONS.AP.SUPPLIER.CREATE);

  const [name, setName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('ZMW');
  const [withholdingProfile, setWithholdingProfile] = useState<'NONE' | 'STANDARD' | 'SPECIAL'>('NONE');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status] = useState<'ACTIVE'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate() {
    const n = name.trim();
    if (!n) return 'Supplier name is required.';
    const e = email.trim();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Email address is not valid.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canCreateSupplier) {
      setError('Permission denied');
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await createSupplier({
        name: name.trim(),
        taxNumber: taxNumber || undefined,
        registrationNumber: registrationNumber || undefined,
        vatRegistered,
        defaultPaymentTerms: defaultPaymentTerms || undefined,
        defaultCurrency: defaultCurrency || undefined,
        withholdingProfile: withholdingProfile || undefined,
        email: email.trim() || undefined,
        phone: phone || undefined,
        address: address || undefined,
      });
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
          Tax Number
          <input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Registration Number
          <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} />
          VAT Registered
        </label>

        <label>
          Default Payment Terms
          <input value={defaultPaymentTerms} onChange={(e) => setDefaultPaymentTerms(e.target.value)} style={{ width: '100%' }} placeholder="Optional" />
        </label>

        <label>
          Default Currency
          <input value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Withholding Profile
          <select value={withholdingProfile} onChange={(e) => setWithholdingProfile(e.target.value as any)} style={{ width: '100%' }}>
            <option value="NONE">NONE</option>
            <option value="STANDARD">STANDARD</option>
            <option value="SPECIAL">SPECIAL</option>
          </select>
        </label>

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%' }} />
        </label>

        <label>
          Address
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
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
