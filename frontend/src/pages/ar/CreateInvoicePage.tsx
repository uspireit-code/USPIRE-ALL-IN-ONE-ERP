import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { AccountLookup, Customer } from '../../services/ar';
import { createInvoice, listEligibleAccounts, listCustomers } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

type Line = {
  accountId: string;
  description: string;
  quantity: string;
  unitPrice: string;
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
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [currency, setCurrency] = useState('USD');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { accountId: '', description: '', quantity: '1', unitPrice: '' },
  ]);

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);

    Promise.all([listCustomers(), listEligibleAccounts()])
      .then(([custs, accs]) => {
        if (!mounted) return;
        setCustomers((custs.items ?? []).filter((c) => c.status === 'ACTIVE'));
        setAccounts(accs);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load lookups'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    const lineTotals = lines.map((l) => {
      const qty = Number(l.quantity) || 0;
      const unitPrice = Number(l.unitPrice) || 0;
      return round2(qty * unitPrice);
    });
    const subtotal = round2(lineTotals.reduce((s, v) => s + v, 0));
    const taxAmount = 0;
    const totalAmount = round2(subtotal + taxAmount);
    return { lineTotals, subtotal, taxAmount, totalAmount };
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: '', description: '', quantity: '1', unitPrice: '' }]);
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

    if (!customerId || !invoiceDate || !dueDate || !currency) {
      setError('Missing required fields');
      return;
    }

    if (lines.length < 1) {
      setError('Invoice must have at least 1 line');
      return;
    }

    for (const l of lines) {
      const qty = Number(l.quantity);
      const unitPrice = Number(l.unitPrice);
      if (!l.accountId || !l.description) {
        setError('Each line requires account and description');
        return;
      }
      if (!(qty > 0)) {
        setError('Each line requires quantity > 0');
        return;
      }
      if (!(unitPrice >= 0)) {
        setError('Each line requires unit price >= 0');
        return;
      }
    }

    setSaving(true);
    try {
      const created = await createInvoice({
        customerId,
        invoiceDate,
        dueDate,
        currency: currency.trim(),
        reference: reference.trim() || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        })),
      });

      navigate(`/finance/ar/invoices/${created.id}`, { replace: true });
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
          <input value="(auto-generated)" readOnly style={{ width: '100%' }} />
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

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Currency
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 2 }}>
            Reference (optional)
            <input value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: '100%' }} />
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
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Line Total</th>
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
                    <input
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                      required
                      inputMode="decimal"
                      style={{ width: 90, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.unitPrice}
                      onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                      required
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{computed.lineTotals[idx]?.toFixed(2)}</td>
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
              Subtotal: <b>{computed.subtotal.toFixed(2)}</b>
            </div>
            <div>Tax: <b>{computed.taxAmount.toFixed(2)}</b></div>
            <div>
              Total: <b>{computed.totalAmount.toFixed(2)}</b>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loadingLookups}>
            {saving ? 'Creating...' : 'Create (DRAFT)'}
          </button>
          <button type="button" onClick={() => navigate('/finance/ar/invoices')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
