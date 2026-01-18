import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { listGlAccounts, type GlAccountLookup } from '../../../services/gl';
import {
  createBankCashAccount,
  getBankCashAccount,
  updateBankCashAccount,
  type BankAccountType,
  type BankCashAccount,
} from '../../../services/bankAccounts';

function money(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function BankCashAccountFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { state } = useAuth();

  const id = params.id as string | undefined;
  const isNew = !id || id === 'new';
  const isEdit = String(params['*'] ?? '').endsWith('edit');

  const canView = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_VIEW);
  }, [state.me]);

  const canCreate = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_CREATE);
  }, [state.me]);

  const canEdit = useMemo(() => {
    return (state.me?.permissions ?? []).includes(PERMISSIONS.BANK.ACCOUNT_EDIT);
  }, [state.me]);

  const canAccess = isNew ? canCreate : canView;
  const canSave = isNew ? canCreate : canEdit;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);

  const [row, setRow] = useState<BankCashAccount | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<BankAccountType>('BANK');
  const [currency, setCurrency] = useState('USD');
  const [glAccountId, setGlAccountId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');

  const assetAccounts = useMemo(() => {
    return (accounts ?? []).filter((a) => a.isActive && a.type === 'ASSET');
  }, [accounts]);

  const selectedGl = useMemo(() => {
    return assetAccounts.find((a) => a.id === glAccountId) ?? null;
  }, [assetAccounts, glAccountId]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, id, isNew]);

  async function load() {
    if (!canAccess) return;
    setLoading(true);
    setError('');
    try {
      const [gl, existing] = await Promise.all([
        listGlAccounts(),
        isNew ? Promise.resolve(null) : getBankCashAccount(String(id)),
      ]);

      setAccounts(Array.isArray(gl) ? gl : []);

      if (existing) {
        setRow(existing);
        setName(existing.name ?? '');
        setType((existing.type ?? 'BANK') as BankAccountType);
        setCurrency(existing.currency ?? '');
        setGlAccountId(existing.glAccountId ?? '');
        setBankName(existing.bankName ?? '');
        setAccountNumber(existing.accountNumber ?? '');
        setOpeningBalance(String(existing.openingBalance ?? 0));
      } else {
        setRow(null);
        if (!currency) setCurrency('USD');
      }

      if (!glAccountId && Array.isArray(gl)) {
        const firstAsset = gl.find((a) => a.isActive && a.type === 'ASSET');
        if (firstAsset) setGlAccountId(firstAsset.id);
      }
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to load bank/cash account'));
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const created = await createBankCashAccount({
          name: name.trim(),
          type,
          currency: currency.trim().toUpperCase(),
          glAccountId,
          bankName: type === 'BANK' ? bankName.trim() : undefined,
          accountNumber: type === 'BANK' ? accountNumber.trim() : undefined,
          openingBalance: openingBalance.trim() || '0',
        });
        navigate(`/finance/cash-bank/bank-accounts/${created.id}`, { replace: true });
      } else {
        const updated = await updateBankCashAccount(String(id), {
          name: name.trim(),
          type,
          currency: currency.trim().toUpperCase(),
          glAccountId,
          bankName: type === 'BANK' ? bankName.trim() : undefined,
          accountNumber: type === 'BANK' ? accountNumber.trim() : undefined,
          openingBalance: openingBalance.trim() || '0',
        });
        navigate(`/finance/cash-bank/bank-accounts/${updated.id}`, { replace: true });
      }
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to save bank/cash account'));
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>{isNew ? 'Create Bank/Cash Account' : 'Bank/Cash Account'}</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  const title = isNew ? 'Create Bank/Cash Account' : isEdit ? 'Edit Bank/Cash Account' : 'Bank/Cash Account';

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {!isNew && row ? (
            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              Status: {row.status} | Current Balance: {money(Number(row.computedBalance ?? 0))}
            </div>
          ) : null}
        </div>
        <Link to="/finance/cash-bank/bank-accounts">Back to list</Link>
      </div>

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        ) : null}

        {loading ? <div>Loading...</div> : null}

        {!loading ? (
          <div style={{ marginTop: 12, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BankAccountType)}
                disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')}
                style={{ height: 36, borderRadius: 10, border: '1px solid rgba(11,12,30,0.16)', padding: '0 12px' }}
              >
                <option value="BANK">BANK</option>
                <option value="CASH">CASH</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Currency</span>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>GL Account (Asset)</span>
              <select
                value={glAccountId}
                onChange={(e) => setGlAccountId(e.target.value)}
                disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')}
                style={{ height: 36, borderRadius: 10, border: '1px solid rgba(11,12,30,0.16)', padding: '0 12px' }}
              >
                <option value="">-- select --</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
              {selectedGl ? <div style={{ fontSize: 12, opacity: 0.7 }}>Selected: {selectedGl.code} ({selectedGl.type})</div> : null}
            </label>

            {type === 'BANK' ? (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Bank Name</span>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Account Number</span>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')} />
                </label>
              </>
            ) : null}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Opening Balance</span>
              <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} disabled={!canSave || saving || (!isNew && row?.status === 'INACTIVE')} />
            </label>

            {!isNew && row?.status === 'INACTIVE' ? (
              <Alert tone="warning" title="Inactive">
                This account is INACTIVE and cannot be edited.
              </Alert>
            ) : null}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {!isNew && !isEdit && canEdit ? (
                <Link to={`/finance/cash-bank/bank-accounts/${id}/edit`} style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" disabled={saving}>Edit</Button>
                </Link>
              ) : null}

              {isNew || isEdit ? (
                <Button
                  variant="primary"
                  onClick={() => void onSave()}
                  disabled={saving || !canSave || !name.trim() || !currency.trim() || !glAccountId || (!isNew && row?.status === 'INACTIVE')}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
