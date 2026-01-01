import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { addStatementLine, getStatement, type BankStatementDetail } from '../../services/bankReconciliation';

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
  const canView = hasPermission('BANK_RECONCILIATION_VIEW');
  const canImport = hasPermission('BANK_STATEMENT_IMPORT');

  const [data, setData] = useState<BankStatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [txDate, setTxDate] = useState(todayIsoDate());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const showAdd = searchParams.get('addLine') === '1';

  useEffect(() => {
    let mounted = true;
    if (!id || !canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getStatement(id)
      .then((res) => {
        if (!mounted) return;
        setData(res);
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

  const reconciledCount = useMemo(() => (data?.lines ?? []).filter((l) => l.isReconciled).length, [data]);

  async function submitAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !canImport) return;

    setAddError(null);

    const n = Number(amount);
    if (!txDate || !description || !(n === 0 || n)) {
      setAddError('Transaction date, description, and amount are required');
      return;
    }

    setAdding(true);
    try {
      await addStatementLine({
        statementId: id,
        transactionDate: txDate,
        description,
        amount: n,
        reference: reference || undefined,
      });

      const refreshed = await getStatement(id);
      setData(refreshed);

      setTxDate(todayIsoDate());
      setDescription('');
      setAmount('');
      setReference('');

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
            <b>Statement date:</b> {data.statementDate.slice(0, 10)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Opening:</b> {money(Number(data.openingBalance))}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Closing:</b> {money(Number(data.closingBalance))}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Lines:</b> {data.lines.length} (reconciled: {reconciledCount})
          </div>

          {canImport ? (
            <div style={{ marginTop: 12 }}>
              <Link to={`/bank-reconciliation/statements/${data.id}?addLine=1`}>Add Statement Line</Link>
            </div>
          ) : null}

          {showAdd ? (
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
                Amount
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
              </label>

              <label>
                Reference
                <input value={reference} onChange={(e) => setReference(e.target.value)} />
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
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Amount</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.transactionDate.slice(0, 10)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.description}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(Number(l.amount))}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{l.isReconciled ? 'Reconciled' : 'Unreconciled'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Reconciled lines are read-only (no unmatch/undo UI).</div>
        </div>
      ) : null}
    </div>
  );
}
