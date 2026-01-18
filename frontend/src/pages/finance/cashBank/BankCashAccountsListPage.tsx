import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import {
  deactivateBankCashAccount,
  listBankCashAccounts,
  type BankCashAccount,
} from '../../../services/bankAccounts';

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function BankCashAccountsListPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_VIEW);
  }, [state.me]);

  const canCreate = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_CREATE);
  }, [state.me]);

  const canEdit = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_EDIT);
  }, [state.me]);

  const canDeactivate = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_DEACTIVATE);
  }, [state.me]);

  const [rows, setRows] = useState<BankCashAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const res = await listBankCashAccounts();
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      setRows([]);
      setError(getApiErrorMessage(e as ApiError, 'Failed to load bank & cash accounts'));
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivate(id: string) {
    if (!canDeactivate) return;
    setDeactivatingId(id);
    setError('');
    try {
      await deactivateBankCashAccount(id);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to deactivate bank/cash account'));
    } finally {
      setDeactivatingId(null);
    }
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Bank & Cash Accounts</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Bank & Cash Accounts</h2>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Governed bank/cash accounts with system-derived balances.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canCreate ? (
            <Link to="/finance/cash-bank/bank-accounts/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Create</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>{error}</div>
              <Button variant="secondary" onClick={() => void load()} disabled={loading || Boolean(deactivatingId)}>
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {loading ? <div>Loading...</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <Alert tone="info" title="No accounts">
            No bank/cash accounts found.
          </Alert>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ padding: '10px 8px' }}>Name</th>
                  <th style={{ padding: '10px 8px' }}>Type</th>
                  <th style={{ padding: '10px 8px' }}>Currency</th>
                  <th style={{ padding: '10px 8px' }}>GL Account</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Current Balance</th>
                  <th style={{ padding: '10px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canDeactivateRow = canDeactivate && r.status === 'ACTIVE' && Number(r.computedBalance ?? 0) === 0;
                  const deactivateDisabledReason =
                    r.status !== 'ACTIVE'
                      ? 'Inactive'
                      : Number(r.computedBalance ?? 0) !== 0
                        ? 'Balance must be 0'
                        : '';

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 8px' }}>{r.name}</td>
                      <td style={{ padding: '10px 8px' }}>{r.type}</td>
                      <td style={{ padding: '10px 8px' }}>{r.currency}</td>
                      <td style={{ padding: '10px 8px' }}>{r.glAccount ? `${r.glAccount.code} - ${r.glAccount.name}` : r.glAccountId}</td>
                      <td style={{ padding: '10px 8px' }}>{r.status}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{money(Number(r.computedBalance ?? 0))}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/finance/cash-bank/bank-accounts/${r.id}`)}>
                          View
                        </Button>
                        {canEdit ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/finance/cash-bank/bank-accounts/${r.id}/edit`)}
                            style={{ marginLeft: 8 }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canDeactivate ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void onDeactivate(r.id)}
                            disabled={!canDeactivateRow || deactivatingId === r.id}
                            title={deactivateDisabledReason || undefined}
                            style={{ marginLeft: 8 }}
                          >
                            {deactivatingId === r.id ? 'Deactivating…' : 'Deactivate'}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
