import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { BankAccount } from '../../services/payments';
import { listBankAccounts } from '../../services/payments';
import { createStatement } from '../../services/bankReconciliation';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateBankStatementPage() {
  const { hasPermission } = useAuth();
  const canImport = hasPermission('BANK_STATEMENT_IMPORT');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState(searchParams.get('bankAccountId') ?? '');
  const [statementDate, setStatementDate] = useState(todayIsoDate());
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('0');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
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
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedBank = useMemo(() => bankAccounts.find((b) => b.id === bankAccountId) ?? null, [bankAccounts, bankAccountId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canImport) return;

    setError(null);

    if (!bankAccountId || !statementDate) {
      setError('Bank account and statement date are required');
      return;
    }

    const ob = Number(openingBalance);
    const cb = Number(closingBalance);

    setSaving(true);
    try {
      const created = await createStatement({
        bankAccountId,
        statementDate,
        openingBalance: ob,
        closingBalance: cb,
      });

      const id = created?.id as string | undefined;
      if (id) {
        navigate(`/bank-reconciliation/statements/${id}`, { replace: true });
      } else {
        navigate(`/bank-reconciliation/statements?bankAccountId=${encodeURIComponent(bankAccountId)}`, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Failed to create statement';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Add Bank Statement</h2>
        <Link to="/bank-reconciliation">Back</Link>
      </div>

      {!canImport ? <div style={{ color: 'crimson' }}>You do not have permission to add bank statements.</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}
      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
        <label>
          Bank Account
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
            <option value="">-- select --</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} {b.accountNumber} ({b.currency})
              </option>
            ))}
          </select>
        </label>

        {selectedBank ? <div style={{ fontSize: 12, color: '#666' }}>Selected: {selectedBank.name}</div> : null}

        <label>
          Statement Date
          <input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required />
        </label>

        <label>
          Opening Balance
          <input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} inputMode="decimal" />
        </label>

        <label>
          Closing Balance
          <input value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} inputMode="decimal" />
        </label>

        <button type="submit" disabled={!canImport || saving}>
          {saving ? 'Saving...' : 'Create'}
        </button>
      </form>
    </div>
  );
}
