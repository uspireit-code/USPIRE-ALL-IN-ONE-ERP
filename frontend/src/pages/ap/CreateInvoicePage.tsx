import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { AccountLookup, Supplier } from '../../services/ap';
import { createInvoice, listEligibleAccounts, listSuppliers } from '../../services/ap';
import { listProjects, type ProjectLookup } from '../../services/gl';
import { LineSegmentFields } from '../../finance/segments/LineSegmentFields';
import { validateLineSegments } from '../../finance/segments/lineSegmentValidation';

type Line = {
  accountId: string;
  description: string;
  amount: string;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function CreateInvoicePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canCreate = hasPermission(PERMISSIONS.AP.INVOICE.CREATE);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<AccountLookup[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [lineErrors, setLineErrors] = useState<
    Record<number, { department?: string; project?: string; fund?: string }>
  >({});

  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [lines, setLines] = useState<Line[]>([{ accountId: '', description: '', amount: '' }]);

  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p] as const)),
    [projects],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a] as const)),
    [accounts],
  );

  useEffect(() => {
    let mounted = true;
    setLoadingLookups(true);
    setError(null);
    setFormErrors([]);
    setLineErrors({});

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

  useEffect(() => {
    const effectiveOn = String(invoiceDate ?? '').slice(0, 10);
    if (!effectiveOn) return;
    listProjects({ effectiveOn })
      .then((ps) => setProjects(Array.isArray(ps) ? ps : []))
      .catch(() => setProjects([]));
  }, [invoiceDate]);

  const totalAmount = useMemo(() => {
    const sum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return round2(sum);
  }, [lines]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setLineErrors((prev) => {
      if (!prev[idx]) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: '', description: '', amount: '' }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);
    setFormErrors([]);
    setLineErrors({});

    if (!supplierId || !invoiceDate || !dueDate) {
      setError('Missing required fields');
      return;
    }

    if (lines.length < 1) {
      setError('Invoice must have at least 1 line');
      return;
    }

    const nextLineErrors: Record<number, { department?: string; project?: string; fund?: string }> = {};
    const nextFormErrors: string[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const l = lines[idx];
      if (!l.accountId || !l.description || !(Number(l.amount) > 0)) {
        nextFormErrors.push(`Line ${idx + 1}: account, description, and amount > 0 are required.`);
        continue;
      }

      const account = accountById.get(l.accountId) ?? null;
      const project = l.projectId ? projectById.get(String(l.projectId)) ?? null : null;
      const seg = validateLineSegments({
        line: {
          accountId: l.accountId,
          departmentId: l.departmentId ?? null,
          projectId: l.projectId ?? null,
          fundId: l.fundId ?? null,
        },
        account,
        project,
        legalEntityRequired: false,
      });

      const mapped: { department?: string; project?: string; fund?: string } = {};
      if (seg.department) mapped.department = seg.department;
      if (seg.project) mapped.project = seg.project;
      if (seg.fund) mapped.fund = seg.fund;
      if (mapped.department || mapped.project || mapped.fund) {
        nextLineErrors[idx] = mapped;
      }
    }

    if (nextFormErrors.length > 0 || Object.keys(nextLineErrors).length > 0) {
      setFormErrors(nextFormErrors);
      setLineErrors(nextLineErrors);
      setError('Please fix validation errors before submitting.');
      return;
    }

    setSaving(true);
    try {
      const created = await createInvoice({
        supplierId,
        invoiceDate,
        dueDate,
        totalAmount,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          amount: Number(l.amount),
          departmentId: l.departmentId ?? undefined,
          projectId: l.projectId ?? undefined,
          fundId: l.fundId ?? undefined,
        })),
      });

      navigate(`/ap/invoices/${created.id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create invoice';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>Create Supplier Invoice</h2>

      {!canCreate ? <div style={{ color: 'crimson' }}>You do not have permission to create invoices.</div> : null}

      {loadingLookups ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Number will be assigned on save.</div>
        {formErrors.length > 0 ? (
          <div style={{ color: 'crimson' }}>
            {formErrors.map((e, idx) => (
              <div key={idx}>{e}</div>
            ))}
          </div>
        ) : null}
        <label>
          Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required style={{ width: '100%' }}>
            <option value="">-- select --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Invoice Date
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            Due Date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required style={{ width: '100%' }} />
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Invoice Lines</div>
            <button type="button" onClick={addLine}>
              Add line
            </button>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <select value={l.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })} required style={{ width: '100%' }}>
                      <option value="">-- select --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} required style={{ width: '100%' }} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <input
                      value={l.amount}
                      onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      required
                      inputMode="decimal"
                      style={{ width: 120, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {lines.map((l, idx) => {
                const account = l.accountId ? accountById.get(l.accountId) ?? null : null;
                const segErr = lineErrors[idx];
                if (!account) return null;
                return (
                  <tr key={`seg-${idx}`}>
                    <td colSpan={4} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <LineSegmentFields
                        effectiveOn={invoiceDate}
                        account={account}
                        values={{
                          departmentId: l.departmentId ?? null,
                          projectId: l.projectId ?? null,
                          fundId: l.fundId ?? null,
                        }}
                        errors={segErr}
                        disabled={saving || loadingLookups}
                        onChange={(patch) => updateLine(idx, patch)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <div>
              Total Amount: <b>{totalAmount.toFixed(2)}</b>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loadingLookups}>
            {saving ? 'Creating...' : 'Create (DRAFT)'}
          </button>
          <button type="button" onClick={() => navigate('/ap/invoices')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
