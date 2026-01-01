import { useEffect, useMemo, useState } from 'react';
import type { BankAccount } from '../../services/payments';
import { listBankAccounts } from '../../services/payments';

export function BankAccountsListPage() {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    listBankAccounts()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
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

  const content = useMemo(() => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'crimson' }}>{error}</div>;

    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Bank</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Account #</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Currency</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.bankName}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.accountNumber}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.currency}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{b.isActive ? 'ACTIVE' : 'INACTIVE'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [error, loading, rows]);

  return (
    <div>
      <h2>Bank Accounts</h2>
      {content}
    </div>
  );
}
