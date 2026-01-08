import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { createCreditNote, getInvoiceById, type CustomerInvoice } from '../../services/ar';

function round2(n: number) {
  return Math.round(Number(n ?? 0) * 100) / 100;
}

type DraftLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  revenueAccountId: string;
};

export function CreditNoteCreatePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission('AR_CREDIT_NOTE_CREATE');

  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [creditNoteDate, setCreditNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');

  const [currency, setCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');

  const [lines, setLines] = useState<DraftLine[]>([{ description: '', quantity: '1', unitPrice: '0', revenueAccountId: '' }]);

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null);
      return;
    }

    let mounted = true;
    setLoadingInvoices(true);
    setInvoiceError(null);

    getInvoiceById(invoiceId)
      .then((inv) => {
        if (!mounted) return;
        setInvoice(inv);
        setCurrency(inv.currency);
        setExchangeRate(String(inv.exchangeRate ?? 1));
      })
      .catch((e: any) => {
        if (!mounted) return;
        setInvoiceError(getApiErrorMessage(e, 'Failed to load invoice'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingInvoices(false);
      });

    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  const invoiceOutstanding = useMemo(() => {
    const total = Number(invoice?.totalAmount ?? 0);
    const remaining = Number(invoice?.outstandingBalance ?? total);
    return round2(remaining);
  }, [invoice?.outstandingBalance, invoice?.totalAmount]);

  const computedTotal = useMemo(() => {
    const sum = lines.reduce((s, l) => s + round2(Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);
    return round2(sum);
  }, [lines]);

  async function onSave() {
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    if (!invoiceId) {
      setError('Original invoice is required');
      return;
    }

    const xr = Number(exchangeRate || 1);
    if (!(xr > 0)) {
      setError('Exchange rate must be > 0');
      return;
    }

    const cleanLines = lines
      .map((l) => ({
        description: String(l.description ?? '').trim(),
        quantity: Number(l.quantity || 0),
        unitPrice: Number(l.unitPrice || 0),
        revenueAccountId: String(l.revenueAccountId ?? '').trim(),
      }))
      .filter((l) => l.description || l.unitPrice > 0 || l.quantity > 0);

    if (cleanLines.length === 0) {
      setError('At least one line is required');
      return;
    }

    for (const l of cleanLines) {
      if (!l.description) {
        setError('Line description is required');
        return;
      }
      if (!(l.quantity >= 0)) {
        setError('Line quantity must be >= 0');
        return;
      }
      if (!(l.unitPrice >= 0)) {
        setError('Line unit price must be >= 0');
        return;
      }
      if (!l.revenueAccountId) {
        setError('Line revenue account is required');
        return;
      }
    }

    const invCustomerId = invoice?.customerId;
    if (!invCustomerId) {
      setError('Invoice customer could not be resolved');
      return;
    }

    setSaving(true);
    try {
      const created = await createCreditNote({
        creditNoteDate,
        customerId: invCustomerId,
        invoiceId,
        memo: memo || undefined,
        currency: currency || 'ZAR',
        exchangeRate: xr,
        lines: cleanLines,
      });

      navigate(`/finance/ar/credit-notes/${created.id}`);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to create credit note'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout
      title="New Credit Note"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={!canCreate || saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <Link to="/finance/ar/credit-notes">Back</Link>
        </div>
      }
    >
      {error ? <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Original Invoice (required)</div>
          <input
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            placeholder="Paste Invoice ID (POSTED)"
            style={{ width: '100%' }}
          />
          {loadingInvoices ? <div style={{ fontSize: 12, marginTop: 4 }}>Loading invoice…</div> : null}
          {invoiceError ? <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>{invoiceError}</div> : null}
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Credit Note Date</div>
          <input type="date" value={creditNoteDate} onChange={(e) => setCreditNoteDate(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Memo / Reason</div>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="(optional)" style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Currency</div>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="ZAR" style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Exchange Rate</div>
          <input value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ gridColumn: '1 / span 2', padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Invoice outstanding balance</div>
            <div style={{ fontWeight: 700 }}>{formatMoney(invoiceOutstanding)}</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            Saving is allowed even if the credit note total exceeds outstanding. Approval/posting will be validated by the server.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Lines</div>
          <button
            type="button"
            onClick={() => setLines((s) => [...s, { description: '', quantity: '1', unitPrice: '0', revenueAccountId: '' }])}
          >
            Add Line
          </button>
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Revenue Account ID</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const amount = round2(Number(l.quantity || 0) * Number(l.unitPrice || 0));
              return (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input
                      value={l.description}
                      onChange={(e) =>
                        setLines((s) => s.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                      }
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.quantity}
                      onChange={(e) => setLines((s) => s.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                      style={{ width: 80, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.unitPrice}
                      onChange={(e) => setLines((s) => s.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)))}
                      style={{ width: 110, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input
                      value={l.revenueAccountId}
                      onChange={(e) =>
                        setLines((s) => s.map((x, i) => (i === idx ? { ...x, revenueAccountId: e.target.value } : x)))
                      }
                      placeholder="Revenue account ID"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(amount)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <button
                      type="button"
                      disabled={lines.length <= 1}
                      onClick={() => setLines((s) => s.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, fontWeight: 700 }}>
          Total: {formatMoney(computedTotal)}
        </div>
      </div>
    </PageLayout>
  );
}
