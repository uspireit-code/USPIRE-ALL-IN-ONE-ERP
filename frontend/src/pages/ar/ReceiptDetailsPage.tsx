import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PageLayout } from '../../components/PageLayout';
import type { ArReceipt, ReceiptLineInput } from '../../services/ar';
import { downloadReceiptExport, getReceiptById, postReceipt, setReceiptAllocations, updateReceipt, voidReceipt } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';
import { getArAging } from '../../services/reports';
import { formatMoney } from '../../money';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function ReceiptDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canRead = hasPermission('RECEIPT_VIEW') || hasPermission('RECEIPT_POST');
  const canCreate = hasPermission('RECEIPT_CREATE');
  const canPost = hasPermission('RECEIPT_POST');
  const canVoid = hasPermission('AR_RECEIPT_VOID');

  const [receipt, setReceipt] = useState<ArReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const [editTotalAmount, setEditTotalAmount] = useState('0.00');
  const [editCurrency, setEditCurrency] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'CASH' | 'CARD' | 'EFT' | 'CHEQUE' | 'OTHER'>('EFT');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [invoiceRows, setInvoiceRows] = useState<
    Array<{ invoiceId: string; invoiceNumber: string; invoiceDate?: string | null; openBalance: number }>
  >([]);

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

        getArAging({ asOf: new Date().toISOString().slice(0, 10) })
          .then((aging) => {
            if (!mounted) return;
            const group = (aging.customers ?? []).find((c) => c.customerId === r.customerId);
            const rows = (group?.invoices ?? [])
              .filter((inv) => Number(inv.outstanding ?? 0) > 0)
              .map((inv) => ({
                invoiceId: inv.invoiceId,
                invoiceNumber: inv.invoiceNumber,
                invoiceDate: inv.invoiceDate,
                openBalance: round2(Number(inv.outstanding ?? 0)),
              }));

            const existingLines = (r.lines ?? []).map((l) => ({
              invoiceId: l.invoiceId,
              invoiceNumber: l.invoiceNumber || l.invoiceId,
              invoiceDate: null as string | null,
              openBalance: 0,
            }));

            const byId = new Map<string, { invoiceId: string; invoiceNumber: string; invoiceDate?: string | null; openBalance: number }>();
            for (const row of rows) byId.set(row.invoiceId, row);
            for (const row of existingLines) if (!byId.has(row.invoiceId)) byId.set(row.invoiceId, row);

            setInvoiceRows(Array.from(byId.values()));
          })
          .catch(() => {
            if (!mounted) return;
            setInvoiceRows((r.lines ?? []).map((l) => ({
              invoiceId: l.invoiceId,
              invoiceNumber: l.invoiceNumber || l.invoiceId,
              invoiceDate: null,
              openBalance: 0,
            })));
          });
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load receipt'));
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
  const isPosted = receipt?.status === 'POSTED';

  const receiptAmount = round2(Number(editTotalAmount) || 0);

  const lines: ReceiptLineInput[] = useMemo(() => {
    return Object.entries(allocations)
      .map(([invoiceId, amount]) => ({ invoiceId, appliedAmount: round2(Number(amount) || 0) }))
      .filter((l) => l.appliedAmount > 0);
  }, [allocations]);

  const appliedTotal = useMemo(() => {
    const sum = lines.reduce((s, l) => s + (Number(l.appliedAmount) || 0), 0);
    return round2(sum);
  }, [lines]);

  const unappliedAmount = useMemo(() => {
    return round2(receiptAmount - appliedTotal);
  }, [appliedTotal, receiptAmount]);

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  async function onExport(format: 'html' | 'pdf') {
    if (!receipt) return;
    setExportBusy(true);
    setError(null);
    try {
      const out = await downloadReceiptExport(receipt.id, format);
      triggerDownload(out.blob, out.fileName);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Export failed'));
    } finally {
      setExportBusy(false);
    }
  }

  async function refresh() {
    if (!id) return;
    const r = await getReceiptById(id);
    setReceipt(r);
  }

  async function onSaveDraft() {
    if (!receipt || !id) return;
    if (!canCreate) {
      setError('You don’t have permission to edit receipts. Required: RECEIPT_CREATE.');
      return;
    }
    if (!isDraft) {
      setError('Only DRAFT receipts can be edited');
      return;
    }

    setError(null);

    for (const inv of invoiceRows) {
      const v = round2(Number(allocations[inv.invoiceId] ?? 0) || 0);
      if (v < 0) {
        setError('Applied amount cannot be negative');
        return;
      }
      if (inv.openBalance > 0 && v > inv.openBalance) {
        setError(`Applied amount exceeds open balance for invoice ${inv.invoiceNumber}`);
        return;
      }
    }

    if (appliedTotal > receiptAmount) {
      setError('Applied total cannot exceed receipt amount');
      return;
    }

    setActing(true);
    try {
      await updateReceipt(id, {
        receiptDate: editReceiptDate,
        currency: editCurrency,
        totalAmount: receiptAmount,
        paymentMethod: editPaymentMethod,
        paymentReference: editPaymentReference || undefined,
      });

      await setReceiptAllocations(id, { lines });

      const updated = await getReceiptById(id);
      setReceipt(updated);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to save receipt'));
    } finally {
      setActing(false);
    }
  }

  async function onPost() {
    if (!receipt || !id) return;
    if (!canPost) {
      setError('You do not have permission to post receipts. Required: RECEIPT_POST.');
      return;
    }

    const ok = window.confirm('Post this receipt? This action is irreversible.');
    if (!ok) return;

    setError(null);
    setActing(true);
    try {
      const updated = await postReceipt(id);
      setReceipt(updated);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to post receipt'));
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
      setError(getApiErrorMessage(err, 'Failed to void receipt'));
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
          {receipt.status === 'DRAFT' && canPost ? (
            <button type="button" disabled={acting} onClick={onPost}>
              Post Receipt
            </button>
          ) : null}
          {receipt.status !== 'VOIDED' && canVoid ? (
            <button type="button" disabled={acting} onClick={onVoid}>
              Void Receipt
            </button>
          ) : null}
          {isPosted ? (
            <>
              <button type="button" onClick={() => void onExport('html')} disabled={exportBusy}>
                {exportBusy ? 'Exporting…' : 'Export (HTML)'}
              </button>
              <button type="button" onClick={() => void onExport('pdf')} disabled={exportBusy}>
                {exportBusy ? 'Exporting…' : 'Export (PDF)'}
              </button>
            </>
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
        {receipt.postedAt ? (
          <div>
            <b>Posted at:</b> {receipt.postedAt}
          </div>
        ) : null}
        {receipt.postedById ? (
          <div>
            <b>Posted by:</b> {receipt.postedById}
          </div>
        ) : null}
        {receipt.glJournalId ? (
          <div>
            <b>GL journal:</b> <Link to={`/finance/gl/journals/${receipt.glJournalId}`}>{receipt.glJournalId}</Link>
          </div>
        ) : null}
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

          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 8, fontSize: 13 }}>
            <div>
              Receipt amount: <b>{formatMoney(receiptAmount, editCurrency)}</b>
            </div>
            <div>
              Applied total: <b>{formatMoney(appliedTotal, editCurrency)}</b>
            </div>
            <div>
              Unapplied: <b>{formatMoney(unappliedAmount, editCurrency)}</b>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice Date</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Open Balance</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Applied</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 8, color: '#666' }}>
                    No open invoices
                  </td>
                </tr>
              ) : null}
              {invoiceRows.map((inv) => {
                const applied = round2(Number(allocations[inv.invoiceId] ?? 0) || 0);
                const remaining = inv.openBalance > 0 ? round2(inv.openBalance - applied) : 0;
                return (
                  <tr key={inv.invoiceId}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <Link to={`/ar/invoices/${inv.invoiceId}`}>{inv.invoiceNumber || inv.invoiceId}</Link>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{inv.invoiceDate ?? ''}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      {inv.openBalance > 0 ? formatMoney(inv.openBalance, editCurrency) : ''}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      <input
                        value={allocations[inv.invoiceId] ?? ''}
                        onChange={(e) => setAllocations((s) => ({ ...s, [inv.invoiceId]: e.target.value }))}
                        disabled={!isDraft}
                        inputMode="decimal"
                        style={{ width: 120, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      {inv.openBalance > 0 ? formatMoney(Math.max(0, remaining), editCurrency) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>

        <button type="button" onClick={() => refresh()} disabled={acting} style={{ width: 120 }}>
          Refresh
        </button>
      </div>
    </PageLayout>
  );
}
