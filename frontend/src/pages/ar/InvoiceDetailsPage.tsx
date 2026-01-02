import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { CustomerInvoice } from '../../services/ar';
import { downloadInvoiceExport, getInvoiceById, postInvoice } from '../../services/ar';
import { getApiErrorMessage } from '../../services/api';

function formatMoney(n: number) {
  return n.toFixed(2);
}

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

  const allowed = useMemo(() => {
    const status = invoice?.status;
    return {
      post: Boolean(invoice) && status === 'DRAFT' && canPost,
      export: Boolean(invoice) && status === 'POSTED',
    };
  }, [canPost, invoice]);

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

      <div style={{ marginTop: 12 }}>
        <div>
          <b>Customer:</b> {invoice.customer?.name ?? '-'}
        </div>
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
                <b>Gross Subtotal:</b> {formatMoney(computed.grossSubtotal)}
              </div>
              <div>
                <b>Less: Discount:</b> {formatMoney(computed.discountTotal)}
              </div>
              <div>
                <b>Net Subtotal:</b> {formatMoney(invoice.subtotal)}
              </div>
            </>
          ) : (
            <div>
              <b>Subtotal:</b> {formatMoney(invoice.subtotal)}
            </div>
          )}
        </div>
        <div>
          <b>Tax:</b> {formatMoney(invoice.taxAmount)}
        </div>
        <div>
          <b>Total:</b> {formatMoney(invoice.totalAmount)}
        </div>
        <div>
          <b>Outstanding Balance:</b> {formatMoney(Number(invoice.outstandingBalance ?? invoice.totalAmount))}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => runAction()} disabled={!allowed.post || acting}>
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
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{Number(l.quantity ?? 0).toFixed(2)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.unitPrice ?? 0))}</td>
                {computed.hasDiscount ? (
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    {Number(l.discountTotal ?? 0) > 0
                      ? Number(l.discountPercent ?? 0) > 0
                        ? `${Number(l.discountPercent).toFixed(2)}%`
                        : formatMoney(Number(l.discountTotal ?? 0))
                      : ''}
                  </td>
                ) : null}
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatMoney(Number(l.lineTotal ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {invoice.status === 'POSTED' ? <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>This invoice is POSTED and cannot be edited.</div> : null}
      </div>
    </div>
  );
}
