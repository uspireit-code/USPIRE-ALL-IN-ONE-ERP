import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import { formatMoney } from '../../money';
import { getApiErrorMessage } from '../../services/api';
import { createRefund, getRefundableForCreditNote, type RefundPaymentMethod } from '../../services/ar';
import { listBankAccounts, type BankAccount } from '../../services/payments';

export function RefundCreatePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission('AR_REFUND_CREATE');

  const [creditNoteId, setCreditNoteId] = useState('');
  const [refundable, setRefundable] = useState<null | {
    creditNoteNumber: string;
    creditNoteDate?: string | null;
    customerId: string;
    currency: string;
    totalAmount: number;
    refunded: number;
    refundable: number;
  }>(null);

  const [refundDate, setRefundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<RefundPaymentMethod>('BANK');
  const [bankAccountId, setBankAccountId] = useState('');

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
    if (!creditNoteId) {
      setRefundable(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    getRefundableForCreditNote(creditNoteId)
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
  }, [creditNoteId]);

  const requireBankAccount = paymentMethod === 'BANK';

  const selectedBank = useMemo(() => {
    if (!bankAccountId) return null;
    return (bankAccounts ?? []).find((b) => b.id === bankAccountId) ?? null;
  }, [bankAccountId, bankAccounts]);

  async function onSave() {
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);

    if (!creditNoteId) {
      setError('Posted credit note is required');
      return;
    }

    if (!refundable) {
      setError('Refundable balance not loaded');
      return;
    }

    const amt = Number(amount || 0);
    if (!(amt > 0)) {
      setError('Refund amount must be > 0');
      return;
    }

    if (requireBankAccount && !bankAccountId) {
      setError('Bank account is required for BANK refunds');
      return;
    }

    setSaving(true);
    try {
      const created = await createRefund({
        refundDate,
        customerId: refundable.customerId,
        creditNoteId,
        currency: refundable.currency,
        exchangeRate: 1,
        amount: amt,
        paymentMethod,
        bankAccountId: requireBankAccount ? bankAccountId : undefined,
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
          <div style={{ fontSize: 12, opacity: 0.8 }}>Posted Credit Note ID (required)</div>
          <input value={creditNoteId} onChange={(e) => setCreditNoteId(e.target.value)} placeholder="Paste POSTED creditNoteId" style={{ width: '100%' }} />
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
          <input type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Refund Amount</div>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%' }} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Payment Method</div>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as RefundPaymentMethod)} style={{ width: '100%' }}>
            <option value="BANK">BANK</option>
            <option value="CASH">CASH</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Bank Account (required for BANK)</div>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
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
          {requireBankAccount && selectedBank && !selectedBank.isActive ? (
            <div style={{ color: 'crimson', fontSize: 12, marginTop: 4 }}>Selected bank account is inactive.</div>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
