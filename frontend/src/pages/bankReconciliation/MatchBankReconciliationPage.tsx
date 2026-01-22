import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import {
  getStatementPreview,
  getStatements,
  getUnmatchedItems,
  matchPayment,
  type BankStatementListItem,
  type UnmatchedPayment,
  type UnmatchedStatementLine,
} from '../../services/bankReconciliation';

function money(n: number) {
  return Number(n).toFixed(2);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function MatchBankReconciliationPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.BANK.RECONCILIATION.VIEW);
  const canReconcile = hasPermission(PERMISSIONS.BANK.RECONCILIATION.MATCH);

  const [searchParams] = useSearchParams();
  const bankAccountId = searchParams.get('bankAccountId') ?? '';

  const [lines, setLines] = useState<UnmatchedStatementLine[]>([]);
  const [payments, setPayments] = useState<UnmatchedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [selectedLineId, setSelectedLineId] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState('');

  const [summary, setSummary] = useState<{ totalStatements: number; matchedCount: number; unmatchedStatementLinesCount: number } | null>(null);

  function resolveActiveStatement(statements: BankStatementListItem[]) {
    const inProgress = statements.find((s) => s.status === 'IN_PROGRESS');
    if (inProgress) return inProgress;
    return (
      statements
        .slice()
        .sort((a, b) => new Date(b.statementEndDate).getTime() - new Date(a.statementEndDate).getTime())[0] ?? null
    );
  }

  const selectedLine = useMemo(() => lines.find((l) => l.id === selectedLineId) ?? null, [lines, selectedLineId]);
  const selectedPayment = useMemo(() => payments.find((p) => p.id === selectedPaymentId) ?? null, [payments, selectedPaymentId]);

  const amountsMatch = useMemo(() => {
    if (!selectedLine || !selectedPayment) return false;
    return round2(Number(selectedLine.amount)) === round2(Number(selectedPayment.amount));
  }, [selectedLine, selectedPayment]);

  async function refresh() {
    if (!canView || !bankAccountId) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const [unmatched, statements] = await Promise.all([getUnmatchedItems(), getStatements(bankAccountId)]);

      const active = resolveActiveStatement(statements);
      if (active) {
        const p = await getStatementPreview(active.id);
        setSummary({
          totalStatements: statements.length,
          matchedCount: p.matchedCount,
          unmatchedStatementLinesCount: p.unmatchedStatementLinesCount,
        });
      } else {
        setSummary({
          totalStatements: statements.length,
          matchedCount: 0,
          unmatchedStatementLinesCount: 0,
        });
      }

      setPayments(unmatched.unreconciledPayments.filter((p: UnmatchedPayment) => p.bankAccountId === bankAccountId));
      setLines(unmatched.unreconciledStatementLines.filter((l: UnmatchedStatementLine) => l.bankStatement.bankAccountId === bankAccountId));

      setSelectedLineId('');
      setSelectedPaymentId('');
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to load unmatched items';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccountId, canView]);

  async function doMatch() {
    if (!selectedLine || !selectedPayment) return;
    if (!canReconcile) {
      setActionError('Permission denied');
      return;
    }

    setActionError(null);

    if (!amountsMatch) {
      setActionError('Amounts must match exactly');
      return;
    }

    setActing(true);
    try {
      await matchPayment({ statementLineId: selectedLine.id, paymentId: selectedPayment.id });
      await refresh();
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Match failed';
      setActionError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActing(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Match Bank Reconciliation</h2>
        <Link to="/bank-reconciliation">Back</Link>
      </div>

      {!canView ? <div style={{ color: 'crimson' }}>You do not have permission to view reconciliation.</div> : null}
      {!bankAccountId ? <div style={{ color: 'crimson', marginTop: 8 }}>Missing bankAccountId. Use the link from the landing page.</div> : null}

      {summary ? (
        <div style={{ marginTop: 12, color: '#666' }}>
          Statements: {summary.totalStatements} | Matched: {summary.matchedCount} | Unmatched lines: {summary.unmatchedStatementLinesCount}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ marginTop: 12, color: 'crimson' }}>{error}</div> : null}

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Unreconciled Statement Lines</div>
          {lines.length === 0 ? <div style={{ marginTop: 8, color: '#666' }}>No unreconciled statement lines.</div> : null}
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Description</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input type="radio" name="line" checked={selectedLineId === l.id} onChange={() => setSelectedLineId(l.id)} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.transactionDate.slice(0, 10)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(l.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Unreconciled Posted Payments</div>
          {payments.length === 0 ? <div style={{ marginTop: 8, color: '#666' }}>No unreconciled posted payments.</div> : null}
          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }} />
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Date</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Type</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Reference</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <input type="radio" name="payment" checked={selectedPaymentId === p.id} onChange={() => setSelectedPaymentId(p.id)} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.paymentDate.slice(0, 10)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.type}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.reference ?? '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={doMatch} disabled={!canReconcile || acting || !selectedLine || !selectedPayment || !amountsMatch}>
          {acting ? 'Matching...' : 'Match selected'}
        </button>

        {selectedLine && selectedPayment ? (
          <div style={{ color: amountsMatch ? 'green' : 'crimson' }}>
            Amount check: {money(Number(selectedLine.amount))} vs {money(Number(selectedPayment.amount))} {amountsMatch ? '(OK)' : '(Mismatch)'}
          </div>
        ) : (
          <div style={{ color: '#666' }}>Select one statement line and one payment.</div>
        )}
      </div>

      {actionError ? <div style={{ marginTop: 12, color: 'crimson' }}>{actionError}</div> : null}

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Exact amount match required. No unmatch/undo UI.</div>
    </div>
  );
}
