import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listBankAccounts } from '../../services/payments';
import type { BankAccount } from '../../services/payments';
import { getReconciliationStatus, getStatements } from '../../services/bankReconciliation';

export function BankReconciliationHomePage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const canView = hasPermission('BANK_RECONCILIATION_VIEW');

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalStatements, setTotalStatements] = useState<number | null>(null);
  const [status, setStatus] = useState<
    | {
        totalStatementLines: number;
        reconciledCount: number;
        unreconciledCount: number;
      }
    | null
  >(null);

  useEffect(() => {
    let mounted = true;
    setLoadingAccounts(true);
    setError(null);

    listBankAccounts()
      .then((banks) => {
        if (!mounted) return;
        setBankAccounts(banks);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load bank accounts';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
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

  async function loadSummary() {
    if (!canView || !bankAccountId) return;
    setError(null);
    setLoadingSummary(true);
    try {
      const [s, statements] = await Promise.all([
        getReconciliationStatus(bankAccountId),
        getStatements(bankAccountId),
      ]);
      setStatus({
        totalStatementLines: s.totalStatementLines,
        reconciledCount: s.reconciledCount,
        unreconciledCount: s.unreconciledCount,
      });
      setTotalStatements(statements.length);
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load reconciliation status';
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
                {b.bankName} {b.accountNumber} ({b.currency})
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

      {status ? (
        <div style={{ marginTop: 16 }}>
          <div>
            <b>Total statements:</b> {totalStatements ?? '-'}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Total statement lines:</b> {status.totalStatementLines}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Reconciled lines:</b> {status.reconciledCount}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Unreconciled lines:</b> {status.unreconciledCount}
          </div>

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
