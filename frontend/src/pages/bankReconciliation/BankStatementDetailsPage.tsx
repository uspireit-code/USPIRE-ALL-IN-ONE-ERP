import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import {
  addStatementLine,
  createAdjustment,
  getFinalSummary,
  getStatement,
  getStatementPreview,
  reconcileStatement,
  type BankReconciliationFinalSummary,
  type BankReconciliationPreview,
  type BankStatementDetail,
  type BankStatementLine,
} from '../../services/bankReconciliation';
import { listAllGlAccounts, type GlAccountLookup } from '../../services/gl';

function money(n: number) {
  return Number(n).toFixed(2);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function BankStatementDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.BANK.RECONCILIATION.VIEW);
  const canImport = hasPermission(PERMISSIONS.BANK.STATEMENT.IMPORT);
  const canReconcile = hasPermission(PERMISSIONS.BANK.RECONCILIATION.MATCH);

  const [data, setData] = useState<BankStatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<BankReconciliationPreview | null>(null);
  const [finalSummary, setFinalSummary] = useState<BankReconciliationFinalSummary | null>(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [txDate, setTxDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const [adjustLine, setAdjustLine] = useState<BankStatementLine | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPostingDate, setAdjustPostingDate] = useState(todayIsoDate());
  const [adjustGlAccountId, setAdjustGlAccountId] = useState('');
  const [adjustMemo, setAdjustMemo] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [glAccounts, setGlAccounts] = useState<GlAccountLookup[]>([]);
  const [glAccountsLoading, setGlAccountsLoading] = useState(false);

  const showAdd = searchParams.get('addLine') === '1';

  useEffect(() => {
    let mounted = true;
    if (!adjustOpen || !canReconcile) return;
    setGlAccountsLoading(true);
    listAllGlAccounts()
      .then((rows) => {
        if (!mounted) return;
        setGlAccounts(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!mounted) return;
        setGlAccounts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setGlAccountsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [adjustOpen, canReconcile]);

  useEffect(() => {
    let mounted = true;
    if (!id || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getStatement(id)
      .then(async (res) => {
        if (!mounted) return;
        setData(res);

        setFinalError(null);
        setFinalSummary(null);
        setPreview(null);

        try {
          if (String(res.status) === 'LOCKED') {
            setFinalLoading(true);
            const s = await getFinalSummary(id);
            if (!mounted) return;
            setFinalSummary(s);
          } else {
            const p = await getStatementPreview(id);
            if (!mounted) return;
            setPreview(p);
          }
        } catch (err: any) {
          if (!mounted) return;
          const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load reconciliation summary';
          setFinalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
          if (!mounted) return;
          setFinalLoading(false);
        }
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load statement';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [canView, id]);

  const isLocked = String(data?.status ?? '') === 'LOCKED';
  const differenceIsZero = Number(preview?.differencePreview ?? 0) === 0;

  async function doReconcileAndLock() {
    if (!id || !data || !canReconcile) return;
    if (String(data.status) === 'LOCKED') return;
    if (!preview || Number(preview.differencePreview) !== 0) return;

    const ok = window.confirm('Once reconciled, this statement will be locked and cannot be edited. Continue?');
    if (!ok) return;

    setError(null);
    setReconciling(true);
    try {
      await reconcileStatement(id);
      const refreshed = await getStatement(id);
      setData(refreshed);

      setPreview(null);
      setFinalError(null);
      setFinalSummary(null);
      setFinalLoading(true);
      const s = await getFinalSummary(id);
      setFinalSummary(s);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to reconcile & lock';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFinalLoading(false);
      setReconciling(false);
    }
  }

  const matchedCount = useMemo(() => (data?.lines ?? []).filter((l) => l.matched).length, [data]);

  const adjustmentCandidates = useMemo(() => {
    if (!adjustLine) return [];
    const t = String(adjustLine.classification ?? '').toUpperCase();
    const expected = t === 'BANK_CHARGE' ? 'EXPENSE' : t === 'INTEREST' ? 'INCOME' : '';
    if (!expected) return [];
    return (glAccounts ?? [])
      .filter((a) => a.isActive && String(a.type ?? '').toUpperCase() === expected)
      .sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')))
      .slice(0, 200);
  }, [adjustLine, glAccounts]);

  function openAdjustment(line: BankStatementLine) {
    if (!canReconcile) return;
    setAdjustError(null);
    setAdjustLine(line);
    setAdjustOpen(true);
    setAdjustPostingDate(line.txnDate?.slice(0, 10) || todayIsoDate());
    setAdjustGlAccountId('');
    setAdjustMemo('');
  }

  function closeAdjustment() {
    setAdjustOpen(false);
    setAdjustLine(null);
    setAdjustError(null);
    setAdjusting(false);
  }

  async function submitAdjustment(e: FormEvent) {
    e.preventDefault();
    if (!id || !canReconcile || !adjustLine) return;

    setAdjustError(null);
    if (!adjustPostingDate || !adjustGlAccountId) {
      setAdjustError('Posting date and GL account are required');
      return;
    }

    setAdjusting(true);
    try {
      await createAdjustment({
        lineId: adjustLine.id,
        glAccountId: adjustGlAccountId,
        postingDate: adjustPostingDate,
        memo: adjustMemo?.trim() ? adjustMemo.trim() : undefined,
      });

      const refreshed = await getStatement(id);
      setData(refreshed);
      closeAdjustment();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create adjustment journal';
      setAdjustError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAdjusting(false);
    }
  }

  async function submitAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !canImport) return;

    setAddError(null);

    const debit = debitAmount ? Number(debitAmount) : 0;
    const credit = creditAmount ? Number(creditAmount) : 0;
    const hasDebit = debitAmount.trim().length > 0;
    const hasCredit = creditAmount.trim().length > 0;

    if (!txDate || !description) {
      setAddError('Transaction date and description are required');
      return;
    }

    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      setAddError('Enter either a debit amount or a credit amount (not both).');
      return;
    }

    setAdding(true);
    try {
      await addStatementLine({
        statementId: id,
        txnDate: txDate,
        description,
        debitAmount: hasDebit ? debit : 0,
        creditAmount: hasCredit ? credit : 0,
      });

      const refreshed = await getStatement(id);
      setData(refreshed);

      setTxDate(todayIsoDate());
      setDescription('');
      setDebitAmount('');
      setCreditAmount('');

      navigate(`/bank-reconciliation/statements/${id}`, { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to add statement line';
      setAddError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bank Statement</h2>
        <Link to={data ? `/bank-reconciliation/statements?bankAccountId=${encodeURIComponent(data.bankAccountId)}` : '/bank-reconciliation/statements'}>
          Back
        </Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view bank statements.</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}

      {data ? (
        <div style={{ marginTop: 12 }}>
          <div>
            <b>Statement window:</b> {data.statementStartDate.slice(0, 10)} - {data.statementEndDate.slice(0, 10)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Status:</b> {data.status}
          </div>

          {isLocked ? (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6, maxWidth: 820 }}>
              <div style={{ fontWeight: 700 }}>Final Reconciliation Summary</div>
              {finalLoading ? <div style={{ marginTop: 8 }}>Loading...</div> : null}
              {finalError ? <div style={{ marginTop: 8, color: 'crimson' }}>{finalError}</div> : null}
              {finalSummary ? (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <b>Bank closing balance:</b> {money(finalSummary.bankClosingBalance)}
                  </div>
                  <div>
                    <b>System bank balance:</b> {money(finalSummary.systemBankBalance)}
                  </div>
                  <div>
                    <b>Outstanding payments:</b> {money(finalSummary.outstandingPaymentsTotal)}
                  </div>
                  <div>
                    <b>Deposits in transit:</b> {money(finalSummary.depositsInTransitTotal)}
                  </div>
                  <div>
                    <b>Adjusted bank balance:</b> {money(finalSummary.adjustedBankBalance)}
                  </div>
                  <div>
                    <b>Adjusted GL balance:</b> {money(finalSummary.adjustedGLBalance)}
                  </div>
                  <div>
                    <b>Difference:</b> {money(finalSummary.difference)}
                  </div>
                  <div>
                    <b>Reconciled at:</b> {finalSummary.reconciledAt ? finalSummary.reconciledAt.slice(0, 19) : '-'}
                  </div>
                  <div>
                    <b>Reconciled by:</b> {finalSummary.reconciledBy ? finalSummary.reconciledBy.name : '-'}
                  </div>
                  <div>
                    <b>Locked at:</b> {finalSummary.lockedAt ? finalSummary.lockedAt.slice(0, 19) : '-'}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 6, maxWidth: 820 }}>
              <div style={{ fontWeight: 700 }}>Reconciliation Preview</div>
              {!preview ? <div style={{ marginTop: 8, color: '#666' }}>Loading...</div> : null}
              {preview ? (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <b>System bank balance (as at end date):</b> {money(preview.systemBankBalanceAsAtEndDate)}
                  </div>
                  <div>
                    <b>Outstanding payments:</b> {money(preview.outstandingPaymentsTotal)}
                  </div>
                  <div>
                    <b>Deposits in transit:</b> {money(preview.depositsInTransitTotal)}
                  </div>
                  <div>
                    <b>Difference preview:</b> {money(preview.differencePreview)}
                  </div>
                </div>
              ) : null}

              {canReconcile && preview && differenceIsZero ? (
                <div style={{ marginTop: 12 }}>
                  <button type="button" onClick={doReconcileAndLock} disabled={reconciling}>
                    {reconciling ? 'Reconciling...' : 'Reconcile & Lock'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <b>Opening:</b> {money(Number(data.openingBalance))}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Closing:</b> {money(Number(data.closingBalance))}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Lines:</b> {data.lines.length} (matched: {matchedCount})
          </div>

          {canImport && !isLocked ? (
            <div style={{ marginTop: 12 }}>
              <Link to={`/bank-reconciliation/statements/${data.id}?addLine=1`}>Add Statement Line</Link>
            </div>
          ) : null}

          {showAdd && !isLocked ? (
            <form onSubmit={submitAddLine} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
              <div style={{ fontWeight: 700 }}>Add Line</div>
              {addError ? <div style={{ color: 'crimson' }}>{addError}</div> : null}

              <label>
                Transaction Date
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
              </label>

              <label>
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>

              <label>
                Debit Amount
                <input value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} inputMode="decimal" />
              </label>

              <label>
                Credit Amount
                <input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} inputMode="decimal" />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={!canImport || adding}>
                  {adding ? 'Adding...' : 'Add'}
                </button>
                <button type="button" onClick={() => navigate(`/bank-reconciliation/statements/${data.id}`)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Debit</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Credit</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => {
                const cls = String(l.classification ?? '').toUpperCase();
                const eligible =
                  canReconcile &&
                  !isLocked &&
                  !l.matched &&
                  !l.adjustmentJournalId &&
                  (cls === 'BANK_CHARGE' || cls === 'INTEREST');

                return (
                  <tr key={l.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.txnDate.slice(0, 10)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(l.debitAmount))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(l.creditAmount))}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.matched ? 'Matched' : 'Unmatched'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                      {l.adjustmentJournalId ? (
                        <Link to={`/finance/gl/journals/${encodeURIComponent(String(l.adjustmentJournalId))}`}>View Journal</Link>
                      ) : eligible ? (
                        <button type="button" onClick={() => openAdjustment(l)}>
                          Create Adjustment
                        </button>
                      ) : (
                        <span style={{ color: '#888' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {adjustOpen ? (
            <div style={{ marginTop: 14, padding: 12, border: '1px solid #ddd', borderRadius: 6, maxWidth: 720 }}>
              <div style={{ fontWeight: 700 }}>Create Adjustment Journal</div>
              {adjustLine ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                  Line: {adjustLine.txnDate.slice(0, 10)} — {adjustLine.description}
                </div>
              ) : null}

              {adjustError ? <div style={{ marginTop: 10, color: 'crimson' }}>{adjustError}</div> : null}

              <form onSubmit={submitAdjustment} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label>
                  Posting Date
                  <input type="date" value={adjustPostingDate} onChange={(e) => setAdjustPostingDate(e.target.value)} required />
                </label>

                <label>
                  GL Account
                  <select
                    value={adjustGlAccountId}
                    onChange={(e) => setAdjustGlAccountId(e.target.value)}
                    disabled={glAccountsLoading || adjusting}
                    required
                  >
                    <option value="">Select account</option>
                    {adjustmentCandidates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Memo (optional)
                  <input value={adjustMemo} onChange={(e) => setAdjustMemo(e.target.value)} disabled={adjusting} />
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={!canReconcile || adjusting}>
                    {adjusting ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" onClick={closeAdjustment} disabled={adjusting}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Matched lines are read-only (no unmatch/undo UI).</div>
        </div>
      ) : null}
    </div>
  );
}
