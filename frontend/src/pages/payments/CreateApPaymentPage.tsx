import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { listInvoices as listApInvoices, type SupplierInvoice } from '../../services/ap';
import type { BankAccount } from '../../services/payments';
import { createPayment, listBankAccounts } from '../../services/payments';

type AllocationRow = {
  invoiceId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceTotal: number;
  allocate: boolean;
  amount: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateApPaymentPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission(PERMISSIONS.PAYMENT.CREATE);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([listBankAccounts(), listApInvoices()])
      .then(([banks, invs]) => {
        if (!mounted) return;
        setBankAccounts(banks);
        const posted = invs.filter((i) => i.status === 'POSTED');
        setInvoices(posted);
        setAllocations(
          posted.map((i) => ({
            invoiceId: i.id,
            supplierName: i.supplier?.name ?? '-',
            invoiceNumber: i.invoiceNumber,
            invoiceTotal: Number(i.totalAmount),
            allocate: false,
            amount: '',
          })),
        );
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load lookups';
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

  const allocSum = useMemo(() => {
    const sum = allocations
      .filter((a) => a.allocate)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return round2(sum);
  }, [allocations]);

  function toggleAllocation(invoiceId: string, allocate: boolean) {
    setAllocations((prev) =>
      prev.map((a) => {
        if (a.invoiceId !== invoiceId) return a;
        return { ...a, allocate, amount: allocate ? a.amount || String(a.invoiceTotal) : '' };
      }),
    );
  }

  function updateAllocationAmount(invoiceId: string, value: string) {
    setAllocations((prev) => prev.map((a) => (a.invoiceId === invoiceId ? { ...a, amount: value } : a)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    const paymentAmount = Number(amount);
    if (!bankAccountId || !paymentDate || !(paymentAmount > 0)) {
      setError('Bank account, payment date, and amount are required');
      return;
    }

    const selected = allocations.filter((a) => a.allocate);
    if (selected.length < 1) {
      setError('Select at least 1 invoice to allocate');
      return;
    }

    if (round2(allocSum) !== round2(paymentAmount)) {
      setError(`Allocations must sum to payment amount. Allocations=${allocSum.toFixed(2)} Amount=${round2(paymentAmount).toFixed(2)}`);
      return;
    }

    for (const a of selected) {
      const n = Number(a.amount);
      if (!(n > 0)) {
        setError('Allocation amounts must be greater than zero');
        return;
      }
      if (n > a.invoiceTotal) {
        setError(`Allocation exceeds invoice total for invoice ${a.invoiceNumber}`);
        return;
      }
    }

    setSaving(true);
    try {
      const created = await createPayment({
        type: 'SUPPLIER_PAYMENT',
        bankAccountId,
        amount: paymentAmount,
        paymentDate,
        reference: reference || undefined,
        allocations: selected.map((a) => ({ sourceType: 'SUPPLIER_INVOICE', sourceId: a.invoiceId, amount: Number(a.amount) })),
      });

      navigate(`/payments/ap/${created.id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create payment';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Create Supplier Payment</h2>
      {!canCreate ? <div style={{ color: 'crimson' }}>You do not have permission to create payments.</div> : null}
      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 950 }}>
        <label>
          Bank Account
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required style={{ width: '100%' }}>
            <option value="">-- select --</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} {b.accountNumber} ({b.currency})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Payment Date
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" style={{ width: '100%', textAlign: 'right' }} />
          </label>
        </div>

        <label>
          Reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: '100%' }} />
        </label>

        <div>
          <div style={{ fontWeight: 600 }}>Allocate to POSTED Supplier Invoices</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Selected allocations must sum exactly to the payment amount.</div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Supplier</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice Total</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Allocate Amount</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.invoiceId}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input type="checkbox" checked={a.allocate} onChange={(e) => toggleAllocation(a.invoiceId, e.target.checked)} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.supplierName}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.invoiceNumber}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{a.invoiceTotal.toFixed(2)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={a.amount}
                      onChange={(e) => updateAllocationAmount(a.invoiceId, e.target.value)}
                      disabled={!a.allocate}
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            Allocations Total: <b>{allocSum.toFixed(2)}</b>
          </div>

          {invoices.length === 0 ? <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No POSTED supplier invoices available for allocation.</div> : null}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loading}>
            {saving ? 'Creating...' : 'Create (DRAFT)'}
          </button>
          <button type="button" onClick={() => navigate('/payments/ap')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
