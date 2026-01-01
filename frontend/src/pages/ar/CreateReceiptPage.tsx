import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import type { Customer, CustomerInvoice, ReceiptLineInput } from '../../services/ar';
import { createReceipt, listCustomers, listInvoices } from '../../services/ar';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function CreateReceiptPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission('AR_RECEIPTS_CREATE');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [receiptDate, setReceiptDate] = useState(todayIsoDate());
  const [currency, setCurrency] = useState('ZAR');
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'EFT' | 'CHEQUE' | 'OTHER'>('EFT');
  const [paymentReference, setPaymentReference] = useState('');

  const [allocations, setAllocations] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);

    Promise.all([listCustomers(), listInvoices()])
      .then(([custs, invs]) => {
        if (!mounted) return;
        setCustomers(custs);
        setInvoices(invs);
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

  const customerInvoices = useMemo(() => {
    if (!customerId) return [];
    return invoices.filter((i) => i.customerId === customerId);
  }, [customerId, invoices]);

  const appliedTotal = useMemo(() => {
    const sum = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
    return round2(sum);
  }, [allocations]);

  const receiptTotal = useMemo(() => {
    return round2(Number(totalAmount) || 0);
  }, [totalAmount]);

  const lines: ReceiptLineInput[] = useMemo(() => {
    return Object.entries(allocations)
      .map(([invoiceId, amount]) => ({ invoiceId, appliedAmount: round2(Number(amount) || 0) }))
      .filter((l) => l.appliedAmount > 0);
  }, [allocations]);

  async function onSaveDraft() {
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    if (!customerId) {
      setError('Customer is required');
      return;
    }

    if (!receiptDate) {
      setError('Receipt date is required');
      return;
    }

    if (!currency) {
      setError('Currency is required');
      return;
    }

    if (receiptTotal < 0) {
      setError('Amount must be >= 0');
      return;
    }

    if (appliedTotal > receiptTotal) {
      setError('Applied total cannot exceed receipt amount');
      return;
    }

    setSaving(true);
    try {
      const created = await createReceipt({
        customerId,
        receiptDate,
        currency,
        totalAmount: receiptTotal,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        lines,
      });

      navigate(`/ar/receipts/${created.id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create receipt';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout
      title="New Receipt"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={!canCreate || saving || loadingLookups} onClick={onSaveDraft}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" onClick={() => navigate('/ar/receipts')}>
            Cancel
          </button>
        </div>
      }
    >
      {!canCreate ? <div style={{ color: 'crimson' }}>You do not have permission to create receipts.</div> : null}

      {loadingLookups ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
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

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Date
            <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Currency
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Amount
            <input value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required inputMode="decimal" style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Payment method
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} style={{ width: '100%' }}>
              <option value="CASH">CASH</option>
              <option value="CARD">CARD</option>
              <option value="EFT">EFT</option>
              <option value="CHEQUE">CHEQUE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
        </div>

        <label>
          Reference
          <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} style={{ width: '100%' }} />
        </label>

        <div>
          <div style={{ fontWeight: 600 }}>Invoice allocation</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Optional. You can leave this empty for an unapplied receipt.</div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice total</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Applied</th>
              </tr>
            </thead>
            <tbody>
              {customerInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.status}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(inv.totalAmount)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={allocations[inv.id] ?? ''}
                      onChange={(e) => setAllocations((s) => ({ ...s, [inv.id]: e.target.value }))}
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
              {customerId && customerInvoices.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 8, color: '#666' }}>
                    No invoices found for customer
                  </td>
                </tr>
              ) : null}
              {!customerId ? (
                <tr>
                  <td colSpan={4} style={{ padding: 8, color: '#666' }}>
                    Select a customer to view invoices
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
            <div>
              Applied total: <b>{formatMoney(appliedTotal)}</b>
            </div>
            <div>
              Receipt amount: <b>{formatMoney(receiptTotal)}</b>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
