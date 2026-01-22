import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import { listBankCashAccounts } from '../../services/bankAccounts';
import type { BankCashAccount } from '../../services/bankAccounts';
import { getStatementPreview, getStatements, reconcileStatement } from '../../services/bankReconciliation';
import type { BankReconciliationPreview, BankStatementListItem } from '../../services/bankReconciliation';

export function BankReconciliationHomePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView = hasPermission(PERMISSIONS.BANK.RECONCILIATION.VIEW);
  const canReconcile = hasPermission(PERMISSIONS.BANK.RECONCILIATION.MATCH);

  const [bankAccounts, setBankAccounts] = useState<BankCashAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatement, setSelectedStatement] = useState<BankStatementListItem | null>(null);
  const [preview, setPreview] = useState<BankReconciliationPreview | null>(null);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingAccounts(true);
    setError(null);

    listBankCashAccounts()
      .then((banks) => {
        if (!mounted) return;
        setBankAccounts(banks);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bank accounts.';
        setError(typeof msg === 'string' ? msg : 'Failed to load bank accounts.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingAccounts(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedBank = useMemo(() => bankAccounts.find((b) => b.id === bankAccountId) ?? null, [bankAccounts, bankAccountId]);

  function resolveActiveStatement(statements: BankStatementListItem[]) {
    const inProgress = statements.find((s) => s.status === 'IN_PROGRESS');
    if (inProgress) return inProgress;

    return (
      statements
        .slice()
        .sort((a, b) => new Date(b.statementEndDate).getTime() - new Date(a.statementEndDate).getTime())[0] ?? null
    );
  }

  async function doReconcileAndLock() {
    if (!canReconcile || !selectedStatement || !preview) return;
    if (selectedStatement.status === 'LOCKED') return;
    if (Number(preview.differencePreview) !== 0) return;

    const ok = window.confirm('Once reconciled, this statement will be locked and cannot be edited. Continue?');
    if (!ok) return;

    setError(null);
    setReconciling(true);
    try {
      await reconcileStatement(selectedStatement.id);
      await loadSummary();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to reconcile & lock';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setReconciling(false);
    }
  }

  async function loadSummary() {
    if (!canView || !bankAccountId) return;
    setError(null);
    setSelectedStatement(null);
    setPreview(null);
    setLoadingSummary(true);
    try {
      const statements = await getStatements(bankAccountId);
      if (!statements.length) {
        setError('No bank statement found for this account. Create a statement first.');
        return;
      }

      const active = resolveActiveStatement(statements);
      if (!active) {
        setError('No bank statement found for this account. Create a statement first.');
        return;
      }

      setSelectedStatement(active);

      const p = await getStatementPreview(active.id);
      setPreview(p);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load reconciliation summary';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div>
      <h2>Bank Reconciliation</h2>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view bank reconciliation.</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          Bank Account
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} disabled={loadingAccounts}>
            <option value="">-- select --</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.currency})
              </option>
            ))}
          </select>
        </label>

        <button onClick={loadSummary} disabled={!canView || !bankAccountId || loadingSummary}>
          {loadingSummary ? 'Loading...' : 'Load Summary'}
        </button>
      </div>

      {selectedBank ? (
        <div style={{ marginTop: 12, color: '#666' }}>
          Selected: <b>{selectedBank.name}</b>
        </div>
      ) : null}

      {selectedStatement && preview ? (
        <div style={{ marginTop: 16 }}>
          <div>
            <b>Active statement:</b> {selectedStatement.id}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Statement end date:</b> {selectedStatement.statementEndDate.slice(0, 10)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Status:</b> {selectedStatement.status}
          </div>

          <div style={{ marginTop: 14 }}>
            <div>
              <b>System bank balance (as at end date):</b> {preview.systemBankBalanceAsAtEndDate}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Outstanding payments total:</b> {preview.outstandingPaymentsTotal}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Deposits in transit total:</b> {preview.depositsInTransitTotal}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Matched count:</b> {preview.matchedCount}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Unmatched statement lines count:</b> {preview.unmatchedStatementLinesCount}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Difference preview:</b> {preview.differencePreview}
            </div>
          </div>

          {canReconcile && selectedStatement.status !== 'LOCKED' && Number(preview.differencePreview) === 0 ? (
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={doReconcileAndLock} disabled={reconciling}>
                {reconciling ? 'Reconciling...' : 'Reconcile & Lock'}
              </button>
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <Link to={`/bank-reconciliation/statements?bankAccountId=${encodeURIComponent(bankAccountId)}`}>View Statements</Link>
            <Link to={`/bank-reconciliation/match?bankAccountId=${encodeURIComponent(bankAccountId)}`}>Match</Link>
            <button type="button" onClick={() => navigate(`/bank-reconciliation/statements/new?bankAccountId=${encodeURIComponent(bankAccountId)}`)}>
              Add Statement
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, color: '#666' }}>Select a bank account to view reconciliation summary.</div>
      )}
    </div>
  );
}
