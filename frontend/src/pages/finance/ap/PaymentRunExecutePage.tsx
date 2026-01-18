import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { listPeriods, type AccountingPeriod } from '../../../services/periods';
import { listBankAccounts, type BankAccount } from '../../../services/payments';
import {
  executePaymentRun,
  listEligiblePaymentProposalsForExecution,
  type EligiblePaymentProposal,
} from '../../../services/paymentRuns';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

function round2(n: number) {
  return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,12,30,0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 620,
          maxWidth: '96vw',
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(11,12,30,0.08)',
          boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid rgba(11,12,30,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
            {props.subtitle ? (
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{props.subtitle}</div>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>
        {props.footer ? (
          <div
            style={{
              padding: 16,
              borderTop: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 -8px 20px rgba(11,12,30,0.06)',
              background: '#fff',
            }}
          >
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PaymentRunExecutePage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  const canExecutePermission = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.AP.PAYMENT_RUN_EXECUTE);
  }, [state.me]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [banksLoaded, setBanksLoaded] = useState(false);

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [eligibleProposals, setEligibleProposals] = useState<EligiblePaymentProposal[]>([]);

  const [executionDate, setExecutionDate] = useState(todayIsoDate());
  const [periodId, setPeriodId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);

  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canExecutePermission) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canExecutePermission]);

  async function load() {
    if (!canExecutePermission) return;
    setLoading(true);
    setError('');
    setPeriodsLoaded(false);
    setBanksLoaded(false);
    try {
      const [p, b, e] = await Promise.all([
        listPeriods(),
        listBankAccounts(),
        listEligiblePaymentProposalsForExecution(),
      ]);

      const openPeriods = (Array.isArray(p) ? p : []).filter((x) => x.status === 'OPEN');
      setPeriods(openPeriods);
      setBankAccounts(Array.isArray(b) ? b : []);
      setEligibleProposals(Array.isArray(e) ? e : []);

      setPeriodsLoaded(true);
      setBanksLoaded(true);

      if (!periodId && openPeriods.length > 0) {
        setPeriodId(openPeriods[0].id);
      }
      if (!bankAccountId && Array.isArray(b) && b.length > 0) {
        setBankAccountId(b[0].id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err as ApiError, 'Failed to load execution inputs'));
    } finally {
      setLoading(false);
    }
  }

  const openPeriodBlocked = !loading && !error && periodsLoaded && periods.length === 0;
  const bankBlocked = !loading && !error && banksLoaded && bankAccounts.length === 0;

  const filteredProposals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return eligibleProposals;
    return eligibleProposals.filter((p) => {
      const proposalNumber = String(p.proposalNumber ?? '').toLowerCase();
      if (proposalNumber.includes(q)) return true;
      return (p.lines ?? []).some((l) => {
        const sup = String(l.supplierName ?? '').toLowerCase();
        const inv = String(l.invoiceNumber ?? '').toLowerCase();
        return sup.includes(q) || inv.includes(q);
      });
    });
  }, [eligibleProposals, searchTerm]);

  const toggleProposal = (proposalId: string) => {
    setSelectedProposalIds((prev) =>
      prev.includes(proposalId) ? prev.filter((id) => id !== proposalId) : [...prev, proposalId],
    );
  };

  const selectedProposals = useMemo(() => {
    const set = new Set(selectedProposalIds);
    return eligibleProposals.filter((p) => set.has(p.id));
  }, [eligibleProposals, selectedProposalIds]);

  const preview = useMemo(() => {
    const lines = selectedProposals.flatMap((p) => p.lines ?? []);
    const total = round2(lines.reduce((s, l) => s + Number(l.proposedPayAmount ?? 0), 0));
    const supplierCount = new Set(lines.map((l) => l.supplierId)).size;
    return {
      lineCount: lines.length,
      supplierCount,
      totalAmount: total,
    };
  }, [selectedProposals]);

  const canExecute =
    Boolean(executionDate) &&
    Boolean(periodId) &&
    Boolean(bankAccountId) &&
    selectedProposalIds.length > 0 &&
    confirmChecked &&
    confirmText === 'EXECUTE' &&
    !submitting;

  const selectedBank = useMemo(() => {
    return bankAccounts.find((b) => b.id === bankAccountId) ?? null;
  }, [bankAccounts, bankAccountId]);

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => p.id === periodId) ?? null;
  }, [periods, periodId]);

  async function doExecute() {
    if (!canExecute) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await executePaymentRun({
        executionDate,
        periodId: periodId || undefined,
        bankAccountId,
        paymentProposalIds: selectedProposalIds,
        reference: reference.trim() || undefined,
      });

      const runId = res?.paymentRun?.id;
      if (runId) {
        navigate(`/finance/ap/payment-runs/${runId}`, { replace: true });
        return;
      }

      navigate('/finance/ap/payment-runs', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err as ApiError, 'Failed to execute payment run'));
    } finally {
      setSubmitting(false);
      setConfirmModalOpen(false);
    }
  }

  if (!canExecutePermission) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Execute Payment Run</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Execute Payment Run</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>Controller-only payment run execution.</div>
        </div>
        <Link to="/finance/ap/payment-runs">Back to history</Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <Alert tone="warning" title="Irreversible">
          Execution is irreversible. Ensure details are correct before proceeding.
        </Alert>
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>{error}</div>
              <Button variant="secondary" onClick={() => void load()} disabled={loading || submitting}>
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {loading ? <div>Loading...</div> : null}

        {!loading && openPeriodBlocked ? (
          <Alert tone="error" title="Blocked">
            No OPEN accounting periods exist. Execution is blocked.
          </Alert>
        ) : null}

        {!loading && bankBlocked ? (
          <Alert tone="error" title="Blocked">
            No active bank/cash accounts exist. Execution is blocked.
          </Alert>
        ) : null}

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Execution Date</span>
            <Input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} disabled={submitting} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Accounting Period (OPEN)</span>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              disabled={submitting || openPeriodBlocked}
              style={{ height: 36, borderRadius: 10, border: '1px solid rgba(11,12,30,0.16)', padding: '0 12px' }}
            >
              <option value="">-- select --</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({String(p.startDate).slice(0, 10)} → {String(p.endDate).slice(0, 10)})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Bank / Cash Account</span>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              disabled={submitting || bankBlocked}
              style={{ height: 36, borderRadius: 10, border: '1px solid rgba(11,12,30,0.16)', padding: '0 12px' }}
            >
              <option value="">-- select --</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} {b.accountNumber} ({b.currency})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Reference (optional)</span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} disabled={submitting} />
          </label>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Select Approved Proposals</h3>
            <div style={{ width: 320, maxWidth: '100%' }}>
              <Input
                placeholder="Search supplier, invoice #, or proposal #"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            The backend executes whole proposals. Selecting a proposal includes all its lines.
          </div>

          {!loading && filteredProposals.length === 0 ? (
            <div style={{ marginTop: 10 }}>
              <Alert tone="info" title="No eligible proposals">
                No APPROVED payment proposals are currently eligible for execution.
              </Alert>
            </div>
          ) : null}

          {filteredProposals.map((p) => {
            const checked = selectedProposalIds.includes(p.id);
            const proposalTotal = round2((p.lines ?? []).reduce((s, l) => s + Number(l.proposedPayAmount ?? 0), 0));
            return (
              <div key={p.id} style={{ marginTop: 12, border: '1px solid rgba(11,12,30,0.10)', borderRadius: 12 }}>
                <div
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    background: 'rgba(11,12,30,0.02)',
                    borderBottom: '1px solid rgba(11,12,30,0.08)',
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={submitting}
                      onChange={() => toggleProposal(p.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.proposalNumber}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Proposal Date: {String(p.proposalDate).slice(0, 10)}</div>
                    </div>
                  </label>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Lines: {(p.lines ?? []).length} | Total: {money(proposalTotal)}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(11,12,30,0.08)' }}>
                        <th style={{ padding: '10px 12px' }}>Supplier</th>
                        <th style={{ padding: '10px 12px' }}>Invoice #</th>
                        <th style={{ padding: '10px 12px' }}>Invoice Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Proposed</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.lines ?? []).map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid rgba(11,12,30,0.06)' }}>
                          <td style={{ padding: '10px 12px' }}>{l.supplierName}</td>
                          <td style={{ padding: '10px 12px' }}>{l.invoiceNumber}</td>
                          <td style={{ padding: '10px 12px' }}>{String(l.invoiceDate).slice(0, 10)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{money(Number(l.proposedPayAmount ?? 0))}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>{money(Number(l.outstandingAmount ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 18, padding: 12, border: '1px solid rgba(11,12,30,0.10)', borderRadius: 12 }}>
          <h3 style={{ margin: 0 }}>Preview Summary</h3>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Bank / Cash Account</div>
              <div style={{ fontWeight: 700 }}>{selectedBank ? `${selectedBank.bankName} ${selectedBank.accountNumber} (${selectedBank.currency})` : '-'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Execution Date</div>
              <div style={{ fontWeight: 700 }}>{executionDate}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Period</div>
              <div style={{ fontWeight: 700 }}>{selectedPeriod ? selectedPeriod.name : '-'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Selected Lines</div>
              <div style={{ fontWeight: 700 }}>{preview.lineCount}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Suppliers</div>
              <div style={{ fontWeight: 700 }}>{preview.supplierCount}</div>
            </div>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Total Amount</div>
              <div style={{ fontWeight: 800 }}>{money(preview.totalAmount)}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: 0 }}>Irreversible Confirmation</h3>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} disabled={submitting} />
              <span>I confirm this payment run is correct and I understand it cannot be reversed here.</span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Type EXECUTE to enable final execution</span>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} disabled={submitting} placeholder="EXECUTE" />
            </label>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={() => setConfirmModalOpen(true)}
              disabled={!canExecute}
              variant="primary"
            >
              {submitting ? 'Executing…' : 'Execute Payment Run'}
            </Button>
          </div>
        </div>

        {confirmModalOpen ? (
          <ModalShell
            title="Confirm Payment Run Execution"
            subtitle="This action is irreversible"
            onClose={() => {
              if (submitting) return;
              setConfirmModalOpen(false);
            }}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void doExecute()} disabled={!canExecute}>
                  {submitting ? 'Executing…' : 'Confirm & Execute'}
                </Button>
              </div>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Total Amount</div>
                <div style={{ fontWeight: 800 }}>{money(preview.totalAmount)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Execution Date</div>
                <div style={{ fontWeight: 700 }}>{executionDate}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Period</div>
                <div style={{ fontWeight: 700 }}>{selectedPeriod ? selectedPeriod.name : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Bank / Cash</div>
                <div style={{ fontWeight: 700 }}>{selectedBank ? `${selectedBank.bankName} ${selectedBank.accountNumber} (${selectedBank.currency})` : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Proposals</div>
                <div style={{ fontWeight: 700 }}>{selectedProposalIds.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Lines</div>
                <div style={{ fontWeight: 700 }}>{preview.lineCount}</div>
              </div>
            </div>
          </ModalShell>
        ) : null}
      </div>
    </div>
  );
}
