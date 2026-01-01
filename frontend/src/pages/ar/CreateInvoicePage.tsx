import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { AccountLookup, Customer } from '../../services/ar';
import { createInvoice, listEligibleAccounts, listCustomers } from '../../services/ar';

type Line = {
  accountId: string;
  description: string;
  amount: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateInvoicePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission('AR_INVOICE_CREATE');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<AccountLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [lines, setLines] = useState<Line[]>([{ accountId: '', description: '', amount: '' }]);

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);

    Promise.all([listCustomers(), listEligibleAccounts()])
      .then(([custs, accs]) => {
        if (!mounted) return;
        setCustomers(custs);
        setAccounts(accs);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load lookups';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalAmount = useMemo(() => {
    const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return round2(sum);
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: '', description: '', amount: '' }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    if (!customerId || !invoiceNumber || !invoiceDate || !dueDate) {
      setError('Missing required fields');
      return;
    }

    if (lines.length < 1) {
      setError('Invoice must have at least 1 line');
      return;
    }

    for (const l of lines) {
      if (!l.accountId || !l.description || !(Number(l.amount) > 0)) {
        setError('Each line requires account, description, and amount > 0');
        return;
      }
    }

    setSaving(true);
    try {
      const created = await createInvoice({
        customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        totalAmount,
        lines: lines.map((l) => ({ accountId: l.accountId, description: l.description, amount: Number(l.amount) })),
      });

      navigate(`/ar/invoices/${created.id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create invoice';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Create Customer Invoice</h2>

      {!canCreate ? <div style={{ color: 'crimson' }}>You do not have permission to create invoices.</div> : null}

      {loadingLookups ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
        <label>
          Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required style={{ width: '100%' }}>
            <option value="">-- select --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Invoice Number
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required style={{ width: '100%' }} />
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Invoice Date
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Due Date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Invoice Lines</div>
            <button type="button" onClick={addLine}>
              Add line
            </button>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <select value={l.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })} required style={{ width: '100%' }}>
                      <option value="">-- select --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} required style={{ width: '100%' }} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input value={l.amount} onChange={(e) => updateLine(idx, { amount: e.target.value })} required inputMode="decimal" style={{ width: 120, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <div>
              Total Amount: <b>{totalAmount.toFixed(2)}</b>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loadingLookups}>
            {saving ? 'Creating...' : 'Create (DRAFT)'}
          </button>
          <button type="button" onClick={() => navigate('/ar/invoices')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
