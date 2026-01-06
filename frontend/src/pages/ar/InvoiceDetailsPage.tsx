import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { CustomerInvoice } from '../../services/ar';
import { downloadInvoiceExport, getInvoiceById, postInvoice } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';
import { listPeriods, type AccountingPeriod } from '../../services/periods';
import { formatMoney } from '../../money';

export function InvoiceDetailsPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const canPost = hasPermission('AR_INVOICE_POST');

  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [periods, setPeriods] = useState<AccountingPeriod[] | null>(null);
  const [periodsError, setPeriodsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    if (!id) {
      setError('Invoice not found');
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getInvoiceById(id)
      .then((inv) => {
        if (!mounted) return;
        setInvoice(inv);
      })
      .catch((err: any) => {
        setError(getApiErrorMessage(err, 'Failed to load invoice'));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    setPeriodsError(null);
    listPeriods()
      .then((p) => {
        if (!mounted) return;
        setPeriods(p ?? []);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setPeriodsError(getApiErrorMessage(err, 'Failed to load accounting periods'));
        setPeriods([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const allowed = useMemo(() => {
    const status = invoice?.status;
    return {
      post: Boolean(invoice) && status === 'DRAFT' && canPost,
      export: Boolean(invoice) && status === 'POSTED',
    };
  }, [canPost, invoice]);

  const periodForInvoiceDate = useMemo(() => {
    const invDate = invoice?.invoiceDate ? new Date(invoice.invoiceDate) : null;
    if (!invDate || Number.isNaN(invDate.getTime())) return null;
    if (!periods) return null;

    const hit = (periods ?? []).find((p) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return start <= invDate && invDate <= end;
    });
    return hit ?? null;
  }, [invoice?.invoiceDate, periods]);

  const postBlockedReason = useMemo(() => {
    if (!allowed.post) return null;
    if (!periods) return 'Checking accounting period…';

    const invoiceType = String((invoice as any)?.invoiceType ?? '').trim();
    const requiresProject =
      invoiceType === 'TRAINING' ||
      invoiceType === 'CONSULTING' ||
      invoiceType === 'SYSTEMS';
    const headerProjectId = String((invoice as any)?.projectId ?? '').trim();
    if (!invoiceType) return 'Invoice type is required before posting.';
    if (requiresProject && !headerProjectId)
      return 'Project is required for this invoice type before posting.';

    if (!periodForInvoiceDate) {
      const ymd = invoice?.invoiceDate?.slice(0, 10) ?? '';
      return ymd ? `No accounting period exists for invoice date ${ymd}.` : 'No accounting period exists for invoice date.';
    }
    if (periodForInvoiceDate.status !== 'OPEN') {
      const code = String(periodForInvoiceDate.code ?? periodForInvoiceDate.name ?? '').trim() || 'UNKNOWN';
      return `Cannot post invoice. Accounting period ${code} is ${periodForInvoiceDate.status}.`;
    }
    return null;
  }, [allowed.post, invoice?.invoiceDate, periodForInvoiceDate, periods]);

  const computed = useMemo(() => {
    const lines = invoice?.lines ?? [];
    const grossSubtotal = lines.reduce((s, l) => s + (Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0)), 0);
    const discountTotal = lines.reduce((s, l) => s + Number(l.discountTotal ?? 0), 0);
    const hasDiscount = discountTotal > 0;
    return {
      grossSubtotal,
      discountTotal,
      hasDiscount,
    };
  }, [invoice?.lines]);

  const balances = useMemo(() => {
    const total = Number(invoice?.totalAmount ?? 0);
    const remaining = Number(invoice?.outstandingBalance ?? invoice?.totalAmount ?? 0);
    const applied = Math.max(0, total - remaining);
    return { total, applied, remaining };
  }, [invoice?.outstandingBalance, invoice?.totalAmount]);

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
    if (!invoice) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const out = await downloadInvoiceExport(invoice.id, format);
      triggerDownload(out.blob, out.fileName);
    } catch (err: any) {
      setActionError(getApiErrorMessage(err, 'Export failed'));
    } finally {
      setExportBusy(false);
    }
  }

  async function runAction() {
    if (!invoice) return;

    setActionError(null);
    setActing(true);
    try {
      const result = await postInvoice(invoice.id);
      if (result?.invoice) {
        setInvoice(result.invoice);
      } else {
        const refreshed = await getInvoiceById(invoice.id);
        setInvoice(refreshed);
      }
    } catch (err: any) {
      setActionError(getApiErrorMessage(err, 'Action failed'));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'crimson' }}>{error}</div>;
  if (!invoice) return <div style={{ color: 'crimson' }}>Invoice not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Invoice {invoice.invoiceNumber}</h2>
        <Link to="/finance/ar/invoices">Back to list</Link>
      </div>

      {periodsError ? <div style={{ color: 'crimson', marginTop: 12 }}>{periodsError}</div> : null}

      {postBlockedReason ? <div style={{ color: 'crimson', marginTop: 12 }}>{postBlockedReason}</div> : null}

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Customer:</b> {invoice.customer?.name ?? '-'}
        </div>
        <div>
          <b>Invoice Type:</b> {(invoice as any).invoiceType ?? '-'}
        </div>
        {(invoice as any).projectId ? (
          <div>
            <b>Project:</b> {(invoice as any).projectId}
          </div>
        ) : null}
        <div>
          <b>Invoice Date:</b> {invoice.invoiceDate?.slice(0, 10)}
        </div>
        <div>
          <b>Due Date:</b> {invoice.dueDate?.slice(0, 10)}
        </div>
        <div>
          <b>Currency:</b> {invoice.currency}
        </div>
        {invoice.reference ? (
          <div>
            <b>Reference:</b> {invoice.reference}
          </div>
        ) : null}
        <div>
          <b>Status:</b> {invoice.status}
        </div>
        <div>
          {computed.hasDiscount ? (
            <>
              <div>
                <b>Gross Subtotal:</b> {formatMoney(computed.grossSubtotal, invoice.currency)}
              </div>
              <div>
                <b>Less: Discount:</b> {formatMoney(computed.discountTotal, invoice.currency)}
              </div>
              <div>
                <b>Net Subtotal:</b> {formatMoney(invoice.subtotal, invoice.currency)}
              </div>
            </>
          ) : (
            <div>
              <b>Subtotal:</b> {formatMoney(invoice.subtotal, invoice.currency)}
            </div>
          )}
        </div>
        <div>
          <b>Tax:</b> {formatMoney(invoice.taxAmount, invoice.currency)}
        </div>
        <div>
          <b>Invoice Total:</b> {formatMoney(balances.total, invoice.currency)}
        </div>
        <div>
          <b>Total Applied Receipts:</b> {formatMoney(balances.applied, invoice.currency)}
        </div>
        <div>
          <b>Remaining Balance:</b> {formatMoney(balances.remaining, invoice.currency)}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => runAction()} disabled={!allowed.post || acting || Boolean(postBlockedReason)}>
          Post
        </button>
        {allowed.export ? (
          <>
            <button type="button" onClick={() => void onExport('html')} disabled={exportBusy}>
              {exportBusy ? 'Exporting…' : 'Export (HTML)'}
            </button>
            <button type="button" onClick={() => void onExport('pdf')} disabled={exportBusy}>
              {exportBusy ? 'Exporting…' : 'Export (PDF)'}
            </button>
          </>
        ) : null}
      </div>

      {actionError ? <div style={{ color: 'crimson', marginTop: 12 }}>{actionError}</div> : null}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600 }}>Lines</div>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Qty</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Unit Price</th>
              {computed.hasDiscount ? <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Discount</th> : null}
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.quantity ?? 0))}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.unitPrice ?? 0), invoice.currency)}</td>
                {computed.hasDiscount ? (
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    {Number(l.discountTotal ?? 0) > 0
                      ? Number(l.discountPercent ?? 0) > 0
                        ? `${Number(l.discountPercent).toFixed(2)}%`
                        : formatMoney(Number(l.discountTotal ?? 0), invoice.currency)
                      : ''}
                  </td>
                ) : null}
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.lineTotal ?? 0), invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {invoice.status === 'POSTED' ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This invoice is POSTED and cannot be edited.</div> : null}
      </div>
    </div>
  );
}
