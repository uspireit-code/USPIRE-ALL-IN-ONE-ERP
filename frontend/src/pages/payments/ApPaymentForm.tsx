import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import {
  listInvoices as listApInvoices,
  listSupplierLookup,
  type SupplierInvoice,
  type SupplierLookup,
} from '../../services/ap';
import type { BankAccount, Payment } from '../../services/payments';
import { listBankAccounts } from '../../services/payments';
import { getSystemConfig } from '../../services/settings';
import {
  listAllGlAccounts,
  listProjects,
  type GlAccountLookup,
  type ProjectLookup,
} from '../../services/gl';
import { LineSegmentFields } from '../../finance/segments/LineSegmentFields';
import { validateLineSegments } from '../../finance/segments/lineSegmentValidation';

type AllocationRow = {
  invoiceId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceTotal: number;
  allocate: boolean;
  amount: string;
};

type AdvanceAllocationRow = {
  amount: string;
  departmentId?: string;
  projectId?: string;
  fundId?: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type ApPaymentSubmitParams = {
  bankAccountId: string;
  amount: number;
  paymentDate: string;
  reference?: string;
  allocations: Array<{
    sourceType: 'SUPPLIER_INVOICE' | 'SUPPLIER_ADVANCE';
    sourceId: string;
    amount: number;
    departmentId?: string;
    projectId?: string;
    fundId?: string;
  }>;
};

export function ApPaymentForm(props: {
  title: string;
  submitLabel: string;
  initialPayment?: Payment | null;
  onSubmit: (params: ApPaymentSubmitParams) => Promise<Payment>;
  onSubmitted: (payment: Payment) => void;
  onCancel?: () => void;
}) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PAYMENT.CREATE);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [advanceAccount, setAdvanceAccount] = useState<GlAccountLookup | null>(null);
  const [projects, setProjects] = useState<ProjectLookup[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [advanceErrors, setAdvanceErrors] = useState<
    Record<number, { department?: string; project?: string; fund?: string }>
  >({});

  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const [paymentMode, setPaymentMode] = useState<'INVOICE' | 'ADVANCE'>('INVOICE');
  const [supplierId, setSupplierId] = useState('');
  const [advanceAllocations, setAdvanceAllocations] = useState<AdvanceAllocationRow[]>([
    { amount: '', departmentId: undefined, projectId: undefined, fundId: undefined },
  ]);

  const hydratedFromInitial = useRef(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      listBankAccounts(),
      listApInvoices(),
      listSupplierLookup(),
      getSystemConfig(),
      listAllGlAccounts(),
      listProjects(),
    ])
      .then(([banks, invs, sups, cfg, glAccounts, projs]) => {
        if (!mounted) return;
        setBankAccounts(banks);
        const posted = (invs ?? []).filter((i) => i.status === 'POSTED');
        setInvoices(posted);
        setSuppliers(sups ?? []);
        setProjects(projs ?? []);

        const advId = String((cfg as any)?.supplierAdvanceAccountId ?? '').trim();
        const adv = advId
          ? (glAccounts ?? []).find((a) => String(a.id) === advId) ?? null
          : null;
        setAdvanceAccount(adv);

        setAllocations(
          posted.map((i) => ({
            invoiceId: i.id,
            supplierName: i.supplier?.name ?? '-',
            invoiceNumber: i.invoiceNumber,
            invoiceTotal: Number(i.totalAmount),
            allocate: false,
            amount: '',
          })),
        );
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load lookups';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (hydratedFromInitial.current) return;

    const p = props.initialPayment;
    if (!p) return;

    hydratedFromInitial.current = true;

    setBankAccountId(p.bankAccountId);
    setPaymentDate(String(p.paymentDate ?? '').slice(0, 10));
    setAmount(String(p.amount ?? ''));
    setReference(p.reference ?? '');

    const hasAdvance = (p.allocations ?? []).some((a) => a.sourceType === 'SUPPLIER_ADVANCE');
    const hasInvoice = (p.allocations ?? []).some((a) => a.sourceType === 'SUPPLIER_INVOICE');

    if (hasAdvance && !hasInvoice) {
      setPaymentMode('ADVANCE');
      const advAllocs = (p.allocations ?? []).filter((a) => a.sourceType === 'SUPPLIER_ADVANCE');
      setSupplierId(advAllocs[0]?.sourceId ?? '');
      setAdvanceAllocations(
        advAllocs.length > 0
          ? advAllocs.map((a) => ({
              amount: String(a.amount ?? ''),
              departmentId: a.departmentId ?? undefined,
              projectId: a.projectId ?? undefined,
              fundId: a.fundId ?? undefined,
            }))
          : [{ amount: '', departmentId: undefined, projectId: undefined, fundId: undefined }],
      );
      setAllocations((prev) => prev.map((r) => ({ ...r, allocate: false, amount: '' })));
      return;
    }

    setPaymentMode('INVOICE');
    const byInvoiceId = new Map(
      (p.allocations ?? [])
        .filter((a) => a.sourceType === 'SUPPLIER_INVOICE')
        .map((a) => [a.sourceId, a] as const),
    );

    setAllocations((prev) =>
      prev.map((r) => {
        const alloc = byInvoiceId.get(r.invoiceId);
        if (!alloc) return { ...r, allocate: false, amount: '' };
        return { ...r, allocate: true, amount: String(alloc.amount ?? '') };
      }),
    );

    setSupplierId('');
    setAdvanceAllocations([{ amount: '', departmentId: undefined, projectId: undefined, fundId: undefined }]);
  }, [loading, props.initialPayment]);

  const allocSum = useMemo(() => {
    const sum = allocations
      .filter((a) => a.allocate)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return round2(sum);
  }, [allocations]);

  const advanceAllocSum = useMemo(() => {
    const sum = (advanceAllocations ?? []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return round2(sum);
  }, [advanceAllocations]);

  const projectById = useMemo(() => {
    return new Map((projects ?? []).map((p) => [p.id, p] as const));
  }, [projects]);

  function toggleAllocation(invoiceId: string, allocate: boolean) {
    setAllocations((prev) =>
      prev.map((a) => {
        if (a.invoiceId !== invoiceId) return a;
        return { ...a, allocate, amount: allocate ? a.amount || String(a.invoiceTotal) : '' };
      }),
    );
  }

  function updateAllocationAmount(invoiceId: string, value: string) {
    setAllocations((prev) => prev.map((a) => (a.invoiceId === invoiceId ? { ...a, amount: value } : a)));
  }

  function updateAdvanceAllocation(idx: number, patch: Partial<AdvanceAllocationRow>) {
    setAdvanceAllocations((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
    setAdvanceErrors((prev) => {
      if (!prev[idx]) return prev;
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  function addAdvanceAllocation() {
    setAdvanceAllocations((prev) => [
      ...prev,
      { amount: '', departmentId: undefined, projectId: undefined, fundId: undefined },
    ]);
  }

  function removeAdvanceAllocation(idx: number) {
    setAdvanceAllocations((prev) => prev.filter((_, i) => i !== idx));
    setAdvanceErrors((prev) => {
      if (!prev[idx]) return prev;
      const next: Record<number, { department?: string; project?: string; fund?: string }> = {};
      for (const k of Object.keys(prev)) {
        const n = Number(k);
        if (n === idx) continue;
        next[n > idx ? n - 1 : n] = prev[n];
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError('Permission denied');
      return;
    }

    setError(null);
    setFormErrors([]);
    setAdvanceErrors({});

    const paymentAmount = Number(amount);
    if (!bankAccountId || !paymentDate || !(paymentAmount > 0)) {
      setError('Bank account, payment date, and amount are required');
      return;
    }

    if (paymentMode === 'INVOICE') {
      const selected = allocations.filter((a) => a.allocate);
      if (selected.length < 1) {
        setError('Select at least 1 invoice to allocate');
        return;
      }

      if (round2(allocSum) !== round2(paymentAmount)) {
        setError(
          `Allocations must sum exactly to the payment amount. Allocations=${allocSum.toFixed(2)} Amount=${round2(paymentAmount).toFixed(2)}`,
        );
        return;
      }

      for (const a of selected) {
        const n = Number(a.amount);
        if (!(n > 0)) {
          setError('Allocation amounts must be greater than zero');
          return;
        }
        if (n > a.invoiceTotal) {
          setError(`Allocation exceeds invoice total for invoice ${a.invoiceNumber}`);
          return;
        }
      }

      setSaving(true);
      try {
        const updated = await props.onSubmit({
          bankAccountId,
          amount: paymentAmount,
          paymentDate,
          reference: reference || undefined,
          allocations: selected.map((a) => ({
            sourceType: 'SUPPLIER_INVOICE',
            sourceId: a.invoiceId,
            amount: Number(a.amount),
          })),
        });
        props.onSubmitted(updated);
      } catch (err: any) {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to save payment';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!supplierId) {
      setError('Supplier is required for advance payments');
      return;
    }
    if (!advanceAccount) {
      setError('Supplier advance account is not configured. Please configure it in Settings.');
      return;
    }

    const cleanAdv = (advanceAllocations ?? [])
      .map((a) => ({
        amount: Number(a.amount) || 0,
        departmentId: String(a.departmentId ?? '').trim() || undefined,
        projectId: String(a.projectId ?? '').trim() || undefined,
        fundId: String(a.fundId ?? '').trim() || undefined,
      }))
      .filter((a) => a.amount > 0 || a.departmentId || a.projectId || a.fundId);

    if (cleanAdv.length < 1) {
      setError('Add at least one advance allocation');
      return;
    }

    if (round2(advanceAllocSum) !== round2(paymentAmount)) {
      setError(
        `Allocations must sum exactly to the payment amount. Allocations=${advanceAllocSum.toFixed(2)} Amount=${round2(paymentAmount).toFixed(2)}`,
      );
      return;
    }

    const nextFormErrors: string[] = [];
    const nextAdvanceErrors: Record<number, { department?: string; project?: string; fund?: string }> = {};

    for (let idx = 0; idx < advanceAllocations.length; idx++) {
      const row = advanceAllocations[idx];
      const amt = Number(row.amount) || 0;
      const isNonEmpty = amt > 0 || Boolean(row.departmentId) || Boolean(row.projectId) || Boolean(row.fundId);
      if (!isNonEmpty) continue;

      if (!(amt > 0)) {
        nextFormErrors.push(`Advance allocation ${idx + 1}: Amount must be > 0.`);
        continue;
      }

      const project = row.projectId ? projectById.get(row.projectId) ?? null : null;
      const seg = validateLineSegments({
        line: {
          accountId: String(advanceAccount.id),
          departmentId: row.departmentId || null,
          projectId: row.projectId || null,
          fundId: row.fundId || null,
        },
        account: advanceAccount,
        project,
        legalEntityRequired: false,
      });

      const mapped: { department?: string; project?: string; fund?: string } = {};
      if (seg.department) mapped.department = seg.department;
      if (seg.project) mapped.project = seg.project;
      if (seg.fund) mapped.fund = seg.fund;
      if (mapped.department || mapped.project || mapped.fund) {
        nextAdvanceErrors[idx] = mapped;
      }
    }

    if (nextFormErrors.length > 0 || Object.keys(nextAdvanceErrors).length > 0) {
      setFormErrors(nextFormErrors);
      setAdvanceErrors(nextAdvanceErrors);
      setError('Please fix the highlighted segment errors before submitting.');
      return;
    }

    setSaving(true);
    try {
      const updated = await props.onSubmit({
        bankAccountId,
        amount: paymentAmount,
        paymentDate,
        reference: reference || undefined,
        allocations: cleanAdv.map((a) => ({
          sourceType: 'SUPPLIER_ADVANCE',
          sourceId: supplierId,
          amount: a.amount,
          departmentId: a.departmentId,
          projectId: a.projectId,
          fundId: a.fundId,
        })),
      });
      props.onSubmitted(updated);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to save payment';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>{props.title}</h2>
      {!canCreate ? (
        <div style={{ color: 'crimson' }}>You do not have permission to create payments.</div>
      ) : null}
      {loading ? <div>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}
      {formErrors.length > 0 ? (
        <div style={{ color: 'crimson', marginTop: 8 }}>
          {formErrors.map((e, idx) => (
            <div key={idx}>{e}</div>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 950 }}
      >
        <label>
          Bank Account
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            required
            style={{ width: '100%' }}
          >
            <option value="">-- select --</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} {b.accountNumber} ({b.currency})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1 }}>
            Payment Date
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ flex: 1 }}>
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              inputMode="decimal"
              style={{ width: '100%', textAlign: 'right' }}
            />
          </label>
        </div>

        <label>
          Reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: '100%' }} />
        </label>

        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="paymentMode"
              checked={paymentMode === 'INVOICE'}
              onChange={() => {
                setPaymentMode('INVOICE');
                setSupplierId('');
                setAdvanceAllocations([
                  { amount: '', departmentId: undefined, projectId: undefined, fundId: undefined },
                ]);
                setFormErrors([]);
                setAdvanceErrors({});
              }}
            />
            Allocate to supplier invoices
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="radio"
              name="paymentMode"
              checked={paymentMode === 'ADVANCE'}
              onChange={() => {
                setPaymentMode('ADVANCE');
                setAllocations((prev) => prev.map((a) => ({ ...a, allocate: false, amount: '' })));
                setFormErrors([]);
                setAdvanceErrors({});
              }}
            />
            Supplier advance
          </label>
        </div>

        {paymentMode === 'INVOICE' ? (
          <div>
            <div style={{ fontWeight: 600 }}>Allocate to POSTED Supplier Invoices</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Selected allocations must sum exactly to the payment amount.
            </div>

            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Supplier</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice #</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Invoice Total</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Allocate Amount</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.invoiceId}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <input
                        type="checkbox"
                        checked={a.allocate}
                        onChange={(e) => toggleAllocation(a.invoiceId, e.target.checked)}
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.supplierName}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{a.invoiceNumber}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{a.invoiceTotal.toFixed(2)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      <input
                        value={a.amount}
                        onChange={(e) => updateAllocationAmount(a.invoiceId, e.target.value)}
                        disabled={!a.allocate}
                        inputMode="decimal"
                        style={{ width: 120, textAlign: 'right' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 8, textAlign: 'right' }}>
              Allocations Total: <b>{allocSum.toFixed(2)}</b>
            </div>

            {invoices.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                No POSTED supplier invoices available for allocation.
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 600 }}>Supplier Advance Allocations</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Advance allocations must sum exactly to the payment amount.
            </div>

            <label style={{ marginTop: 10 }}>
              Supplier
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">-- select --</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {!advanceAccount ? (
              <div style={{ marginTop: 8, fontSize: 12, color: 'crimson' }}>
                Supplier advance account is not configured.
              </div>
            ) : null}

            <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, width: 140 }}>Amount</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Segments</th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: 8, width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {advanceAllocations.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                      <input
                        value={a.amount}
                        onChange={(e) => updateAdvanceAllocation(idx, { amount: e.target.value })}
                        inputMode="decimal"
                        style={{ width: 120, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <LineSegmentFields
                        effectiveOn="Supplier Advance"
                        account={advanceAccount}
                        values={{
                          departmentId: a.departmentId ?? null,
                          projectId: a.projectId ?? null,
                          fundId: a.fundId ?? null,
                        }}
                        errors={advanceErrors[idx]}
                        disabled={!advanceAccount}
                        onChange={(patch) => {
                          updateAdvanceAllocation(idx, {
                            departmentId:
                              patch.departmentId === undefined
                                ? a.departmentId
                                : patch.departmentId || undefined,
                            projectId:
                              patch.projectId === undefined ? a.projectId : patch.projectId || undefined,
                            fundId: patch.fundId === undefined ? a.fundId : patch.fundId || undefined,
                          });
                        }}
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      <button
                        type="button"
                        disabled={advanceAllocations.length <= 1}
                        onClick={() => removeAdvanceAllocation(idx)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={addAdvanceAllocation}>
                Add allocation
              </button>
              <div>
                Allocations Total: <b>{advanceAllocSum.toFixed(2)}</b>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={!canCreate || saving || loading}>
            {saving ? 'Saving...' : props.submitLabel}
          </button>
          {props.onCancel ? (
            <button type="button" onClick={props.onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
