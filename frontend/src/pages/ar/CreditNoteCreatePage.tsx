import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { createCreditNote, getInvoiceById, listEligibleCreditNoteCustomers, listEligibleCreditNoteInvoices, type CustomerInvoice, type EligibleCreditNoteCustomerRow, type EligibleCreditNoteInvoiceRow } from '../../services/ar';

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

  const canCreate = hasPermission('CREDIT_NOTE_CREATE');

  const [customers, setCustomers] = useState<EligibleCreditNoteCustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');

  const [postedInvoices, setPostedInvoices] = useState<EligibleCreditNoteInvoiceRow[]>([]);
  const [postedInvoicesLoading, setPostedInvoicesLoading] = useState(false);
  const [postedInvoicesError, setPostedInvoicesError] = useState<string | null>(null);

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
    let mounted = true;
    setCustomersLoading(true);
    setCustomersError(null);
    listEligibleCreditNoteCustomers()
      .then((resp) => {
        if (!mounted) return;
        setCustomers(resp.items ?? []);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setCustomers([]);
        setCustomersError(getApiErrorMessage(e, 'Failed to load customers'));
      })
      .finally(() => {
        if (!mounted) return;
        setCustomersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!customerId) {
      setPostedInvoices([]);
      setInvoiceId('');
      setInvoice(null);
      return;
    }

    let mounted = true;
    setPostedInvoicesLoading(true);
    setPostedInvoicesError(null);

    listEligibleCreditNoteInvoices(customerId)
      .then((res) => {
        if (!mounted) return;
        setPostedInvoices(res.items ?? []);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setPostedInvoices([]);
        setPostedInvoicesError(getApiErrorMessage(e, 'Failed to load posted invoices'));
      })
      .finally(() => {
        if (!mounted) return;
        setPostedInvoicesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [customerId]);

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

        const defaultLines = (inv.lines ?? []).map((l) => ({
          description: String(l.description ?? '').trim(),
          quantity: String(Number(l.quantity ?? 1)),
          unitPrice: String(Number(l.unitPrice ?? 0)),
          revenueAccountId: String(l.accountId ?? '').trim(),
        }));
        if (defaultLines.length > 0) {
          setLines(defaultLines);
        }
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

  const selectedEligibleInvoice = useMemo(() => {
    return (postedInvoices ?? []).find((x) => String(x.invoiceId) === String(invoiceId)) ?? null;
  }, [invoiceId, postedInvoices]);

  const invoiceOutstanding = useMemo(() => {
    const remaining = Number(selectedEligibleInvoice?.outstandingBalance ?? 0);
    return round2(remaining);
  }, [selectedEligibleInvoice?.outstandingBalance]);

  useEffect(() => {
    if (!invoiceId) return;
    console.log('Invoice selected:', selectedEligibleInvoice);
    console.log('Net outstanding used:', invoiceOutstanding);
  }, [invoiceId, invoiceOutstanding, selectedEligibleInvoice]);

  const computedTotal = useMemo(() => {
    const sum = lines.reduce((s, l) => s + round2(Number(l.quantity || 0) * Number(l.unitPrice || 0)), 0);
    return round2(sum);
  }, [lines]);

  const exceedsOutstanding = useMemo(() => {
    if (!invoiceId) return false;
    if (!(invoiceOutstanding > 0)) return false;
    return computedTotal > invoiceOutstanding;
  }, [computedTotal, invoiceId, invoiceOutstanding]);

  async function onSave() {
    if (!canCreate) {
      setError('You don’t have permission to create credit notes. Required: CREDIT_NOTE_CREATE.');
      return;
    }

    setError(null);

    if (!customerId) {
      setError('Customer is required');
      return;
    }

    if (!invoiceId) {
      setError('Original invoice is required');
      return;
    }

    if (!invoice || String(invoice.status ?? '').toUpperCase() !== 'POSTED') {
      setError('Invoice must be POSTED');
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

    setSaving(true);
    try {
      const created = await createCreditNote({
        creditNoteDate,
        customerId,
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
        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Customer (required)</div>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: '100%' }} disabled={customersLoading}>
            <option value="">(select customer)</option>
            {(customers ?? []).map((c) => (
              <option key={c.customerId} value={c.customerId}>
                {c.customerName}{c.customerCode ? ` (${c.customerCode})` : ''}
              </option>
            ))}
          </select>
          {customersLoading ? <div style={{ fontSize: 12, marginTop: 4 }}>Loading customers…</div> : null}
          {customersError ? <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>{customersError}</div> : null}
          {!customersLoading && !customersError && (customers ?? []).length === 0 ? (
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>No customers with posted invoices found.</div>
          ) : null}
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Original Invoice (POSTED) (required)</div>
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            style={{ width: '100%' }}
            disabled={!customerId || postedInvoicesLoading}
          >
            <option value="">(select posted invoice)</option>
            {(postedInvoices ?? []).map((inv) => (
              <option key={inv.invoiceId} value={inv.invoiceId}>
                {inv.invoiceNumber} - bal {formatMoney(Number(inv.outstandingBalance ?? 0))} {inv.currency}
              </option>
            ))}
          </select>
          {postedInvoicesLoading ? <div style={{ fontSize: 12, marginTop: 4 }}>Loading posted invoices…</div> : null}
          {postedInvoicesError ? <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>{postedInvoicesError}</div> : null}
          {customerId && !postedInvoicesLoading && !postedInvoicesError && (postedInvoices ?? []).length === 0 ? (
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>No posted invoices found for this customer.</div>
          ) : null}
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
            <div style={{ fontWeight: 700 }}>Invoice Outstanding (NET)</div>
            <div style={{ fontWeight: 700 }}>{formatMoney(invoiceOutstanding)}</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            Saving is allowed even if the credit note total exceeds outstanding. Approval/posting will be validated by the server.
          </div>
          {exceedsOutstanding ? (
            <div style={{ fontSize: 12, color: 'crimson', marginTop: 6 }}>
              This credit note exceeds the outstanding balance and cannot be submitted.
            </div>
          ) : null}
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
                      disabled
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
