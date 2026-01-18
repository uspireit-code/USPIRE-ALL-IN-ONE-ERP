import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { createPaymentProposal, submitPaymentProposal } from '../../../services/paymentProposals';
import {
  listEligibleApInvoicesForPaymentProposal,
  type EligibleApInvoice,
} from '../../../services/paymentProposalEligibleInvoices';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function PaymentProposalCreatePage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const canCreate = useMemo(() => {
    const perms = state.me?.permissions ?? [];
    return perms.includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE);
  }, [state.me]);

  const canSubmit = useMemo(() => {
    const perms = state.me?.permissions ?? [];
    return perms.includes(PERMISSIONS.AP.PAYMENT_PROPOSAL_SUBMIT);
  }, [state.me]);

  const [proposalDate, setProposalDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [eligible, setEligible] = useState<EligibleApInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [selected, setSelected] = useState<Record<string, { invoiceId: string; proposedPayAmount: number }>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canCreate) return;
    void loadEligible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate]);

  async function loadEligible() {
    setLoading(true);
    setError('');
    try {
      const res = await listEligibleApInvoicesForPaymentProposal({ search: search.trim() || undefined, limit: 200 });
      setEligible(Array.isArray(res) ? res : []);
    } catch (e) {
      setEligible([]);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load eligible invoices'));
    } finally {
      setLoading(false);
    }
  }

  function toggle(invoice: EligibleApInvoice) {
    if (Number(invoice.remainingProposableAmount ?? 0) <= 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[invoice.id]) {
        delete next[invoice.id];
        return next;
      }
      next[invoice.id] = {
        invoiceId: invoice.id,
        proposedPayAmount: Number(invoice.remainingProposableAmount ?? 0),
      };
      return next;
    });
    setLineErrors((prev) => {
      const next = { ...prev };
      delete next[invoice.id];
      return next;
    });
  }

  function clampAmount(amount: number, max: number) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (Number.isFinite(max) && n > max) return max;
    return n;
  }

  function setAmount(invoiceId: string, amount: number) {
    setSelected((prev) => {
      if (!prev[invoiceId]) return prev;
      return {
        ...prev,
        [invoiceId]: {
          invoiceId,
          proposedPayAmount: amount,
        },
      };
    });
  }

  function validateLines(nextSelected: Record<string, { invoiceId: string; proposedPayAmount: number }>) {
    const errs: Record<string, string> = {};
    const selLines = Object.values(nextSelected);
    if (selLines.length === 0) {
      return { ok: false, errs, total: 0 };
    }

    const eligibleMap = new Map(eligible.map((e) => [e.id, e] as const));
    let total = 0;
    for (const l of selLines) {
      const inv = eligibleMap.get(l.invoiceId);
      const max = Number(inv?.remainingProposableAmount ?? 0);
      const amt = Number(l.proposedPayAmount ?? 0);
      if (amt <= 0) {
        errs[l.invoiceId] = 'Proposed amount must be greater than zero.';
        continue;
      }
      if (amt > max) {
        errs[l.invoiceId] = `Remaining payable balance available: ${money(max)}`;
        continue;
      }
      total += amt;
    }

    if (total <= 0) {
      return { ok: false, errs, total };
    }
    return { ok: Object.keys(errs).length === 0, errs, total };
  }

  const selectedLines = useMemo(() => Object.values(selected), [selected]);
  const totalSelected = useMemo(() => selectedLines.reduce((s, l) => s + Number(l.proposedPayAmount ?? 0), 0), [selectedLines]);

  const selectionValidation = useMemo(() => {
    return validateLines(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, eligible]);

  async function onCreate(submitAfter: boolean) {
    if (!canCreate) return;

    const v = validateLines(selected);
    setLineErrors(v.errs);
    if (!v.ok) {
      setError(
        selectedLines.length === 0
          ? 'Select at least one invoice.'
          : 'Fix validation errors before saving.',
      );
      return;
    }

    setError('');
    try {
      const created = await createPaymentProposal({
        proposalDate,
        notes: notes.trim() || undefined,
        lines: selectedLines,
      });

      if (submitAfter) {
        if (!canSubmit) {
          throw new Error('You do not have permission to submit proposals');
        }
        const submitted = await submitPaymentProposal(created.id);
        navigate(`/finance/ap/payment-proposals/${submitted.id}`);
        return;
      }

      navigate(`/finance/ap/payment-proposals/${created.id}`);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to create proposal'));
    }
  }

  if (!canCreate) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Create Payment Proposal</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Create Payment Proposal</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Select eligible posted invoices and set proposed payment amounts.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Proposal Date</div>
          <input
            type="date"
            value={proposalDate}
            onChange={(e) => setProposalDate(e.target.value)}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </div>

        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Notes</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            style={{ height: 36, width: '100%', padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ minWidth: 260, flex: '1 1 260px' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Search invoices / suppliers</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice number or supplier"
            style={{ height: 36, width: '100%', padding: '0 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </div>
        <button
          type="button"
          onClick={() => void loadEligible()}
          disabled={loading}
          style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {error ? <div style={{ marginTop: 12, color: '#b00020' }}>{error}</div> : null}

      <div style={{ marginTop: 14, overflowX: 'auto', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
          <thead>
            <tr style={{ background: 'rgba(2,4,69,0.05)' }}>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }} />
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Supplier</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Invoice #</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Invoice Date</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Due Date</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Total</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Outstanding</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Reserved</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Remaining Proposable</th>
              <th style={{ textAlign: 'right', padding: 12, fontSize: 12 }}>Proposed Pay</th>
            </tr>
          </thead>
          <tbody>
            {eligible.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 14, opacity: 0.75 }}>
                  {loading ? 'Loading…' : 'No eligible invoices found.'}
                </td>
              </tr>
            ) : (
              eligible.map((inv) => {
                const isSel = Boolean(selected[inv.id]);
                const remaining = Number(inv.remainingProposableAmount ?? 0);
                const canSelect = remaining > 0;
                return (
                  <tr key={inv.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: 12 }}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        disabled={!canSelect}
                        onChange={() => toggle(inv)}
                      />
                    </td>
                    <td style={{ padding: 12 }}>{inv.supplierName}</td>
                    <td style={{ padding: 12 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: 12 }}>{String(inv.invoiceDate).slice(0, 10)}</td>
                    <td style={{ padding: 12 }}>{String(inv.dueDate).slice(0, 10)}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>{money(inv.totalAmount)}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>{money(inv.outstandingAmount)}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>{money(Number(inv.reservedAmount ?? 0))}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>{money(remaining)}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      {isSel ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <input
                            type="number"
                            step="0.01"
                            min={0.01}
                            max={remaining}
                            value={selected[inv.id]?.proposedPayAmount ?? 0}
                            onChange={(e) => {
                              const max = remaining;
                              const raw = Number(e.target.value);
                              const next = clampAmount(raw, max);
                              setAmount(inv.id, next);
                              setLineErrors((prev) => {
                                const errs = { ...prev };
                                delete errs[inv.id];
                                if (next <= 0) errs[inv.id] = 'Proposed amount must be greater than zero.';
                                else if (next > max) errs[inv.id] = `Remaining payable balance available: ${money(max)}`;
                                return errs;
                              });
                            }}
                            onBlur={() => {
                              const max = remaining;
                              const cur = Number(selected[inv.id]?.proposedPayAmount ?? 0);
                              const next = clampAmount(cur, max);
                              if (next !== cur) setAmount(inv.id, next);
                              setLineErrors((prev) => {
                                const errs = { ...prev };
                                delete errs[inv.id];
                                if (next <= 0) errs[inv.id] = 'Proposed amount must be greater than zero.';
                                else if (next > max) errs[inv.id] = `Remaining payable balance available: ${money(max)}`;
                                return errs;
                              });
                            }}
                            style={{
                              height: 32,
                              width: 140,
                              padding: '0 8px',
                              borderRadius: 8,
                              border: lineErrors[inv.id]
                                ? '1px solid #b00020'
                                : '1px solid rgba(0,0,0,0.2)',
                              textAlign: 'right',
                            }}
                          />
                          {lineErrors[inv.id] ? (
                            <div style={{ color: '#b00020', fontSize: 12, maxWidth: 240, textAlign: 'right' }}>
                              {lineErrors[inv.id]}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ opacity: 0.8 }}>
          Selected: {selectedLines.length} | Total Proposed: <b>{money(totalSelected)}</b>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={selectedLines.length === 0 || !selectionValidation.ok}
            onClick={() => void onCreate(false)}
            style={{ height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)', background: 'white' }}
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={selectedLines.length === 0 || !selectionValidation.ok || !canSubmit}
            onClick={() => void onCreate(true)}
            style={{ height: 38, padding: '0 14px', borderRadius: 8, border: 0, background: '#020445', color: 'white' }}
          >
            Save & Submit
          </button>
        </div>
      </div>
    </div>
  );
}
