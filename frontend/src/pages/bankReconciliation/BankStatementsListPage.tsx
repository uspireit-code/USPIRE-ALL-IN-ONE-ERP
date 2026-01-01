import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listBankAccounts } from '../../services/payments';
import type { BankAccount } from '../../services/payments';
import { getStatements, type BankStatementListItem } from '../../services/bankReconciliation';

function money(n: number) {
  return Number(n).toFixed(2);
}

export function BankStatementsListPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('BANK_RECONCILIATION_VIEW');
  const canImport = hasPermission('BANK_STATEMENT_IMPORT');

  const [searchParams, setSearchParams] = useSearchParams();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statements, setStatements] = useState<BankStatementListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bankAccountId = searchParams.get('bankAccountId') ?? '';
  const selectedBank = useMemo(() => bankAccounts.find((b) => b.id === bankAccountId) ?? null, [bankAccounts, bankAccountId]);

  useEffect(() => {
    let mounted = true;
    listBankAccounts()
      .then((banks) => {
        if (!mounted) return;
        setBankAccounts(banks);
      })
      .catch(() => {
        // ignore; will show errors when calling endpoints requiring bankAccountId
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!canView || !bankAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getStatements(bankAccountId)
      .then((rows) => {
        if (!mounted) return;
        setStatements(rows);
      })
      .catch((err: any) => {
        const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load statements';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bankAccountId, canView]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bank Statements</h2>
        <Link to="/bank-reconciliation">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view bank statements.</div> : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'end' }}>
        <label>
          Bank Account
          <select
            value={bankAccountId}
            onChange={(e) => {
              const next = e.target.value;
              setSearchParams(next ? { bankAccountId: next } : {});
            }}
          >
            <option value="">-- select --</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} {b.accountNumber} ({b.currency})
              </option>
            ))}
          </select>
        </label>

        {canImport && bankAccountId ? (
          <Link to={`/bank-reconciliation/statements/new?bankAccountId=${encodeURIComponent(bankAccountId)}`}>Add Statement</Link>
        ) : null}
      </div>

      {selectedBank ? <div style={{ marginTop: 12, color: '#666' }}>Selected: {selectedBank.name}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}

      {!loading && canView && bankAccountId && statements.length === 0 ? (
        <div style={{ marginTop: 12, color: '#666' }}>No statements found for selected bank account.</div>
      ) : null}

      {statements.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Statement Date</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Opening</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Closing</th>
            </tr>
          </thead>
          <tbody>
            {statements.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <Link to={`/bank-reconciliation/statements/${s.id}`}>{s.statementDate.slice(0, 10)}</Link>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(s.openingBalance))}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(s.closingBalance))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!bankAccountId ? <div style={{ marginTop: 12, color: '#666' }}>Select a bank account to view statements.</div> : null}
    </div>
  );
}
