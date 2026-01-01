import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import type { ArReceipt, ReceiptLineInput } from '../../services/ar';
import { getReceiptById, postReceipt, updateReceipt, voidReceipt } from '../../services/ar';

function formatMoney(n: number) {
  return Number(n ?? 0).toFixed(2);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function ReceiptDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canRead = hasPermission('AR_RECEIPTS_VIEW');
  const canCreate = hasPermission('AR_RECEIPTS_CREATE');
  const canVoid = hasPermission('AR_RECEIPT_VOID');

  const [receipt, setReceipt] = useState<ArReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [editTotalAmount, setEditTotalAmount] = useState('0.00');
  const [editCurrency, setEditCurrency] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'CARD' | 'EFT' | 'CHEQUE' | 'OTHER'>('EFT');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canRead) return;
    if (!id) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getReceiptById(id)
      .then((r) => {
        if (!mounted) return;
        setReceipt(r);

        setEditTotalAmount(String(r.totalAmount));
        setEditCurrency(r.currency);
        setEditReceiptDate(r.receiptDate);
        setEditPaymentMethod(r.paymentMethod);
        setEditPaymentReference(r.paymentReference ?? '');

        const map: Record<string, string> = {};
        for (const l of r.lines ?? []) {
          map[l.invoiceId] = String(l.appliedAmount);
        }
        setAllocations(map);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load receipt';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [canRead, id]);

  const isDraft = receipt?.status === 'DRAFT';

  const lines: ReceiptLineInput[] = useMemo(() => {
    return Object.entries(allocations)
      .map(([invoiceId, amount]) => ({ invoiceId, appliedAmount: round2(Number(amount) || 0) }))
      .filter((l) => l.appliedAmount > 0);
  }, [allocations]);

  const appliedTotal = useMemo(() => {
    const sum = lines.reduce((s, l) => s + (Number(l.appliedAmount) || 0), 0);
    return round2(sum);
  }, [lines]);

  async function refresh() {
    if (!id) return;
    const r = await getReceiptById(id);
    setReceipt(r);
  }

  async function onSaveDraft() {
    if (!receipt || !id) return;
    if (!canCreate) {
      setError('Permission denied');
      return;
    }
    if (!isDraft) {
      setError('Only DRAFT receipts can be edited');
      return;
    }

    setError(null);

    const totalAmount = round2(Number(editTotalAmount) || 0);
    if (appliedTotal > totalAmount) {
      setError('Applied total cannot exceed receipt amount');
      return;
    }

    setActing(true);
    try {
      const updated = await updateReceipt(id, {
        receiptDate: editReceiptDate,
        currency: editCurrency,
        totalAmount,
        paymentMethod: editPaymentMethod,
        paymentReference: editPaymentReference || undefined,
        lines,
      });
      setReceipt(updated);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to save receipt';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  async function onPost() {
    if (!receipt || !id) return;
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);
    setActing(true);
    try {
      const updated = await postReceipt(id);
      setReceipt(updated);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to post receipt';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  async function onVoid() {
    if (!receipt || !id) return;
    if (!canVoid) {
      setError('Permission denied');
      return;
    }

    const reason = window.prompt('Void reason (required):');
    if (!reason || reason.trim().length < 2) {
      setError('Void reason is required');
      return;
    }

    setError(null);
    setActing(true);
    try {
      const updated = await voidReceipt(id, reason);
      setReceipt(updated);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to void receipt';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  if (!canRead) {
    return (
      <PageLayout title="Receipt">
        <div style={{ color: 'crimson' }}>Permission denied</div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title="Receipt">
        <div>Loading...</div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Receipt">
        <div style={{ color: 'crimson' }}>{error}</div>
      </PageLayout>
    );
  }

  if (!receipt) {
    return (
      <PageLayout title="Receipt">
        <div style={{ color: 'crimson' }}>Receipt not found</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Receipt ${receipt.receiptNumber}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {isDraft && canCreate ? (
            <button type="button" disabled={acting} onClick={onSaveDraft}>
              Save Draft
            </button>
          ) : null}
          {receipt.status === 'DRAFT' && canCreate ? (
            <button type="button" disabled={acting} onClick={onPost}>
              Post Receipt
            </button>
          ) : null}
          {receipt.status !== 'VOIDED' && canVoid ? (
            <button type="button" disabled={acting} onClick={onVoid}>
              Void Receipt
            </button>
          ) : null}
          <button type="button" onClick={() => navigate('/ar/receipts')}>
            Back
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 8, fontSize: 13, color: '#333' }}>
        <div>
          <b>Status:</b> {receipt.status}
        </div>
        <div>
          <b>Customer:</b> {receipt.customerName}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Date
            <input type="date" value={editReceiptDate} onChange={(e) => setEditReceiptDate(e.target.value)} disabled={!isDraft} style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Currency
            <input value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} disabled={!isDraft} style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Amount
            <input value={editTotalAmount} onChange={(e) => setEditTotalAmount(e.target.value)} disabled={!isDraft} inputMode="decimal" style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Payment method
            <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value as any)} disabled={!isDraft} style={{ width: '100%' }}>
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
          <input value={editPaymentReference} onChange={(e) => setEditPaymentReference(e.target.value)} disabled={!isDraft} style={{ width: '100%' }} />
        </label>

        <div>
          <div style={{ fontWeight: 600 }}>Invoice allocation</div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Applied</th>
              </tr>
            </thead>
            <tbody>
              {(receipt.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 8, color: '#666' }}>
                    No allocations
                  </td>
                </tr>
              ) : null}
              {(receipt.lines ?? []).map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <Link to={`/ar/invoices/${l.invoiceId}`}>{l.invoiceNumber || l.invoiceId}</Link>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={allocations[l.invoiceId] ?? String(l.appliedAmount)}
                      onChange={(e) => setAllocations((s) => ({ ...s, [l.invoiceId]: e.target.value }))}
                      disabled={!isDraft}
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            Applied total: <b>{formatMoney(appliedTotal)}</b>
          </div>
        </div>

        {!isDraft ? <div style={{ fontSize: 12, color: '#666' }}>This receipt is {receipt.status} and cannot be edited.</div> : null}

        <button type="button" onClick={() => refresh()} disabled={acting} style={{ width: 120 }}>
          Refresh
        </button>
      </div>
    </PageLayout>
  );
}
