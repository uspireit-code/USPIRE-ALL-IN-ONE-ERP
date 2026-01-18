import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { createRefund, getRefundableForCreditNote, listRefundableCreditNotes, listRefundableCustomers, type RefundableCustomerRow, type RefundPaymentMethod, type RefundableCreditNoteRow } from '../../services/ar';
import { listBankAccounts, type BankAccount } from '../../services/payments';

export function RefundCreatePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission(PERMISSIONS.AR.REFUND.CREATE);

  const [form, setForm] = useState(() => ({
    customerId: '',
    postedCreditNoteId: '',
    refundDate: new Date().toISOString().slice(0, 10),
    amount: '0',
    currency: '',
    exchangeRate: 1,
    paymentMethod: 'BANK' as RefundPaymentMethod,
    bankAccountId: '',
  }));

  const [customers, setCustomers] = useState<RefundableCustomerRow[]>([]);

  const [creditNotes, setCreditNotes] = useState<RefundableCreditNoteRow[]>([]);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);
  const [creditNotesError, setCreditNotesError] = useState<string | null>(null);
  const [refundable, setRefundable] = useState<null | {
    creditNoteNumber: string;
    creditNoteDate?: string | null;
    customerId: string;
    currency: string;
    totalAmount: number;
    refunded: number;
    refundable: number;
  }>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listBankAccounts()
      .then((rows) => setBankAccounts(rows ?? []))
      .catch(() => setBankAccounts([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    listRefundableCustomers()
      .then((resp) => {
        if (!mounted) return;
        setCustomers(resp.items ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setCustomers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.customerId) {
      setCreditNotes([]);
      setForm((prev) => ({
        ...prev,
        postedCreditNoteId: '',
        currency: '',
        exchangeRate: 1,
      }));
      setRefundable(null);
      return;
    }

    let mounted = true;
    setCreditNotesLoading(true);
    setCreditNotesError(null);

    listRefundableCreditNotes(form.customerId)
      .then((res) => {
        if (!mounted) return;
        const items = res.items ?? [];
        setCreditNotes(items);

        if (items.length === 1) {
          setForm((prev) => ({
            ...prev,
            postedCreditNoteId: items[0].id,
          }));
        }
      })
      .catch((e: any) => {
        if (!mounted) return;
        setCreditNotes([]);
        setCreditNotesError(getApiErrorMessage(e, 'Failed to load refundable credit notes'));
      })
      .finally(() => {
        if (!mounted) return;
        setCreditNotesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [form.customerId]);

  useEffect(() => {
    if (!form.postedCreditNoteId) {
      setRefundable(null);
      setForm((prev) => ({
        ...prev,
        currency: '',
        exchangeRate: 1,
      }));
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    getRefundableForCreditNote(form.postedCreditNoteId)
      .then((res) => {
        if (!mounted) return;
        setRefundable({
          creditNoteNumber: res.creditNote.creditNoteNumber,
          creditNoteDate: res.creditNote.creditNoteDate ?? null,
          customerId: res.creditNote.customerId,
          currency: res.creditNote.currency,
          totalAmount: Number(res.creditNote.totalAmount ?? 0),
          refunded: Number(res.refunded ?? 0),
          refundable: Number(res.refundable ?? 0),
        });
        setForm((prev) => ({
          ...prev,
          amount: String(Number(res.refundable ?? 0)),
          currency: String(res.creditNote.currency ?? ''),
          exchangeRate: Number((res.creditNote as any).exchangeRate ?? 1),
        }));
      })
      .catch((e: any) => {
        if (!mounted) return;
        setRefundable(null);
        setError(getApiErrorMessage(e, 'Failed to load refundable balance'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [form.postedCreditNoteId]);

  const requireBankAccount = form.paymentMethod === 'BANK';

  const selectedBank = useMemo(() => {
    if (!form.bankAccountId) return null;
    return (bankAccounts ?? []).find((b) => b.id === form.bankAccountId) ?? null;
  }, [form.bankAccountId, bankAccounts]);

  async function onSave() {
    if (!canCreate) {
      setError(`You don’t have permission to create refunds. Required: ${PERMISSIONS.AR.REFUND.CREATE}.`);
      return;
    }

    setError(null);

    if (!form.customerId) {
      setError('Customer is required');
      return;
    }

    if (!form.postedCreditNoteId) {
      setError('Posted credit note is required');
      return;
    }

    if (!refundable) {
      setError('Refundable balance not loaded');
      return;
    }

    const amt = Number(form.amount || 0);
    if (!(amt > 0)) {
      setError('Refund amount must be > 0');
      return;
    }

    if (requireBankAccount && !form.bankAccountId) {
      setError('Bank account is required for BANK refunds');
      return;
    }

    setSaving(true);
    try {
      const created = await createRefund({
        refundDate: form.refundDate,
        customerId: refundable.customerId,
        creditNoteId: form.postedCreditNoteId,
        currency: form.currency || refundable.currency,
        exchangeRate: form.exchangeRate,
        amount: amt,
        paymentMethod: form.paymentMethod,
        bankAccountId: requireBankAccount ? form.bankAccountId : undefined,
      });

      navigate(`/finance/ar/refunds/${created.id}`);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to create refund'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout
      title="New Refund"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={!canCreate || saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <Link to="/finance/ar/refunds">Back</Link>
        </div>
      }
    >
      {error ? <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Customer (required)</div>
          <select
            value={form.customerId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                customerId: e.target.value,
              }))
            }
            style={{ width: '100%' }}
            disabled={Boolean(form.postedCreditNoteId)}
          >
            <option value="">(select customer)</option>
            {(customers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Posted Credit Note (required)</div>
          <select
            value={form.postedCreditNoteId ?? ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                postedCreditNoteId: e.target.value,
              }))
            }
            style={{ width: '100%' }}
            disabled={!form.customerId || creditNotesLoading}
          >
            <option value="">(select posted credit note)</option>
            {(creditNotes ?? []).map((cn) => (
              <option key={cn.id} value={cn.id}>
                {cn.creditNoteNumber} {cn.creditNoteDate ? `(${cn.creditNoteDate})` : ''} - refundable {formatMoney(Number(cn.refundable ?? 0))}
              </option>
            ))}
          </select>
          {creditNotesLoading ? <div style={{ fontSize: 12, marginTop: 4 }}>Loading refundable credit notes…</div> : null}
          {creditNotesError ? <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>{creditNotesError}</div> : null}
          {form.customerId && !creditNotesLoading && !creditNotesError && (creditNotes ?? []).length === 0 ? (
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>No refundable credit notes available.</div>
          ) : null}
          {loading ? <div style={{ fontSize: 12, marginTop: 4 }}>Loading refundable balance…</div> : null}
        </div>

        {refundable ? (
          <div style={{ gridColumn: '1 / span 2', padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Credit Note Total</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(refundable.totalAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Already Refunded</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(refundable.refunded)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Available Refundable</div>
                <div style={{ fontWeight: 700 }}>{formatMoney(refundable.refundable)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Backend will enforce refundable balance at approve/post.
            </div>
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Refund Date</div>
          <input
            type="date"
            value={form.refundDate}
            onChange={(e) => setForm((prev) => ({ ...prev, refundDate: e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Refund Amount</div>
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Payment Method</div>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value as RefundPaymentMethod }))}
            style={{ width: '100%' }}
          >
            <option value="BANK">BANK</option>
            <option value="CASH">CASH</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Bank Account (required for BANK)</div>
          <select
            value={form.bankAccountId}
            onChange={(e) => setForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
            style={{ width: '100%' }}
            disabled={!requireBankAccount}
          >
            <option value="">(select)</option>
            {(bankAccounts ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} - {b.accountNumber} ({b.currency})
              </option>
            ))}
          </select>
          {requireBankAccount && selectedBank && selectedBank.status !== 'ACTIVE' ? (
            <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>Selected bank account is inactive.</div>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
