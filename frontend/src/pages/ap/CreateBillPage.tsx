import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import type { AccountLookup, Supplier } from '../../services/ap';
import { createBill, listEligibleAccounts, listSuppliers } from '../../services/ap';

type Line = {
  accountId: string;
  description: string;
  amount: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateBillPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission(PERMISSIONS.AP.INVOICE_CREATE);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<AccountLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [lines, setLines] = useState<Line[]>([{ accountId: '', description: '', amount: '' }]);

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);
    setFieldErrors({});
    setFormErrors([]);

    Promise.all([listSuppliers(), listEligibleAccounts()])
      .then(([sups, accs]) => {
        if (!mounted) return;
        setSuppliers(sups);
        setAccounts(accs);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load lookups';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalAmount = useMemo(() => {
    const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return round2(sum);
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: '', description: '', amount: '' }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!canCreate) {
      setError('You do not have permission to access this page.');
      return;
    }

    setError(null);

    const nextFieldErrors: Record<string, string> = {};
    const nextFormErrors: string[] = [];

    if (!supplierId) {
      nextFieldErrors.supplierId = 'Supplier is required.';
    }
    if (!billDate) {
      nextFieldErrors.billDate = 'Bill date is required.';
    }
    if (!dueDate) {
      nextFieldErrors.dueDate = 'Due date is required.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormErrors(nextFormErrors);
      return;
    }

    setFieldErrors({});
    setFormErrors([]);

    if (!billNumber.trim()) {
      setFieldErrors({ billNumber: 'Bill number is required.' });
      return;
    }

    const mappedLines = lines
      .map((l) => ({
        accountId: l.accountId,
        description: l.description,
        amount: Number(l.amount),
      }))
      .filter((l) => l.accountId && l.description?.trim() && Number.isFinite(l.amount) && l.amount !== 0);

    if (mappedLines.length === 0) {
      setFormErrors(['At least one line is required.']);
      return;
    }

    setSaving(true);
    try {
      await createBill({
        supplierId,
        invoiceNumber: billNumber,
        invoiceDate: billDate,
        dueDate,
        totalAmount,
        lines: mappedLines,
      });
      navigate('/ap/bills');
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const body = err?.body;

      if (status === 400 && body && typeof body === 'object') {
        const nextFe: Record<string, string> = {};
        const nextForm: string[] = [];

        const backendFieldErrors = Array.isArray((body as any).fieldErrors) ? (body as any).fieldErrors : [];
        for (const fe of backendFieldErrors) {
          const field = String(fe?.field ?? '').trim();
          const message = String(fe?.message ?? '').trim();
          if (!field || !message) continue;

          if (field === 'supplierId') nextFe.supplierId = message;
          else if (field === 'invoiceDate') nextFe.billDate = message;
          else if (field === 'dueDate') nextFe.dueDate = message;
          else if (field === 'invoiceNumber') nextFe.billNumber = message;
          else nextForm.push(message);
        }

        const generalMessage = typeof (body as any).message === 'string' ? (body as any).message : '';
        if (generalMessage && nextForm.length === 0 && Object.keys(nextFe).length === 0) {
          nextForm.push(generalMessage);
        }

        setFieldErrors(nextFe);
        setFormErrors(nextForm);
        return;
      }

      const msg = body?.message ?? body?.error ?? 'Failed to create bill';
      setFormErrors([typeof msg === 'string' ? msg : JSON.stringify(msg)]);
    } finally {
      setSaving(false);
    }
  }

  if (!canCreate) return <div>You do not have permission to access this page.</div>;
  if (loadingLookups) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>Create Bill</h2>

      {error ? <div style={{ color: 'crimson', marginBottom: 10 }}>{error}</div> : null}
      {formErrors.length > 0 ? (
        <div style={{ color: 'crimson', marginBottom: 10 }}>
          {formErrors.map((e, idx) => (
            <div key={idx}>{e}</div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 260px', gap: 10, alignItems: 'center' }}>
        <div>Supplier</div>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {fieldErrors.supplierId ? <div style={{ color: 'crimson' }}>{fieldErrors.supplierId}</div> : <div />}

        <div>Bill #</div>
        <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
        {fieldErrors.billNumber ? <div style={{ color: 'crimson' }}>{fieldErrors.billNumber}</div> : <div />}

        <div>Bill Date</div>
        <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        {fieldErrors.billDate ? <div style={{ color: 'crimson' }}>{fieldErrors.billDate}</div> : <div />}

        <div>Due Date</div>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {fieldErrors.dueDate ? <div style={{ color: 'crimson' }}>{fieldErrors.dueDate}</div> : <div />}
      </div>

      <div style={{ marginTop: 18, fontWeight: 600 }}>Lines</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {lines.map((l, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 120px 90px', gap: 8 }}>
            <select value={l.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}>
              <option value="">Account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
            <input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="Description" />
            <input value={l.amount} onChange={(e) => updateLine(idx, { amount: e.target.value })} placeholder="0.00" />
            <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={addLine}>
          Add Line
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <b>Total:</b> {totalAmount.toFixed(2)}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="button" onClick={submit} disabled={!canCreate || saving}>
          {saving ? 'Saving…' : 'Create Bill'}
        </button>
      </div>
    </div>
  );
}
