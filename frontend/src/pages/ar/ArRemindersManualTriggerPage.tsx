import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { ApiError } from '../../services/api';
import { getInvoiceById, listInvoices, type CustomerInvoice } from '../../services/ar';
import { sendReminder } from '../../services/arReminders';

export function ArRemindersManualTriggerPage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission('AR_REMINDER_VIEW') || hasPermission('FINANCE_VIEW_ALL') || hasPermission('SYSTEM_VIEW_ALL');
  const canTrigger = hasPermission('AR_REMINDER_TRIGGER');

  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const debugApi = (import.meta.env.VITE_DEBUG_API ?? '').toString().toLowerCase() === 'true';

  useEffect(() => {
    if (!canView) return;
    setInvoicesLoading(true);
    void listInvoices({ page: 1, pageSize: 50, status: 'POSTED' })
      .then((resp) => setInvoices((resp as any)?.items ?? []))
      .catch(() => undefined)
      .finally(() => setInvoicesLoading(false));
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    if (!invoiceId.trim()) {
      setInvoice(null);
      return;
    }

    setLoadingInvoice(true);
    void getInvoiceById(invoiceId)
      .then((inv) => setInvoice(inv as any))
      .catch(() => setInvoice(null))
      .finally(() => setLoadingInvoice(false));
  }, [canView, invoiceId]);

  const errBody = (error as ApiError | any)?.body;
  const errMsg =
    typeof errBody?.message === 'string'
      ? errBody.message
      : typeof errBody === 'string'
        ? errBody
        : typeof errBody?.error === 'string'
          ? errBody.error
          : typeof errBody?.reason === 'string'
            ? errBody.reason
            : error
              ? 'Failed to send reminder.'
              : '';

  const clientValidationError = useMemo(() => {
    if (!canTrigger) return '';
    if (!invoiceId.trim()) return 'Please select an invoice.';
    return '';
  }, [canTrigger, invoiceId]);

  async function run() {
    if (!canTrigger) return;

    setError(null);
    setResult(null);

    const msg = clientValidationError;
    if (msg) {
      setError({ body: { message: msg } });
      return;
    }

    setSending(true);
    try {
      const res = await sendReminder({ invoiceId: invoiceId.trim(), triggerMode: 'MANUAL' });
      setResult(res);
    } catch (e) {
      setError(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>AR Reminders — Manual Trigger</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/ar/reminders/rules">Rules</Link>
          <Link to="/ar/reminders/templates">Templates</Link>
          <Link to="/ar">Back</Link>
        </div>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view AR Reminders.</div> : null}
      {canView && !canTrigger ? (
        <div style={{ color: 'crimson', marginTop: 8 }}>You do not have permission to manually trigger reminders.</div>
      ) : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <label>
          Invoice
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            disabled={!canView || invoicesLoading || sending}
            style={{ minWidth: 340 }}
          >
            <option value="">Select an invoice…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {(inv as any).invoiceNumber ?? inv.id}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => void run()} disabled={!canTrigger || sending}>
          {sending ? 'Sending…' : 'Send reminder'}
        </button>
      </div>

      {loadingInvoice ? <div style={{ marginTop: 12, color: '#666' }}>Loading invoice details…</div> : null}

      {invoice ? (
        <div style={{ marginTop: 12, fontSize: 13, color: '#444' }}>
          <div>
            <b>Invoice:</b> {(invoice as any).invoiceNumber ?? invoice.id}
          </div>
          <div>
            <b>Customer:</b> {(invoice as any).customer?.name ?? (invoice as any).customerNameSnapshot ?? ''}
          </div>
          <div>
            <b>Due date:</b> {(invoice as any).dueDate ? String((invoice as any).dueDate).slice(0, 10) : ''}
          </div>
        </div>
      ) : null}

      {errMsg ? <div style={{ color: 'crimson', marginTop: 12 }}>{errMsg}</div> : null}
      {debugApi && error ? <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(errBody ?? error, null, 2)}</pre> : null}

      {result ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>Reminder queued (audit logged)</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Safety controls:
        <br />
        - Only 1 reminder per invoice per day
        <br />
        - Escalation is enforced by backend
      </div>
    </div>
  );
}
