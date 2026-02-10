import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getApiErrorMessage } from '../../services/api';
import type { CoaAccount } from '../../services/coa';
import { listCoa } from '../../services/coa';
import { getFinanceApControlAccount, updateFinanceApControlAccount } from '../../services/settings';

export function SettingsFinanceControlAccountsPage() {
  const { hasPermission } = useAuth();

  const canEdit =
    hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);

  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apControlAccountId, setApControlAccountId] = useState<string>('');

  const liabilityAccounts = useMemo(() => {
    return (coa ?? [])
      .filter((a) => a.isActive && a.type === 'LIABILITY')
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [coa]);

  const load = () => {
    if (!canEdit) return;
    setLoading(true);
    setError(null);

    Promise.all([getFinanceApControlAccount(), listCoa()])
      .then(([cfg, coaRes]) => {
        setApControlAccountId(String(cfg?.apControlAccountId ?? ''));
        setCoa(coaRes?.accounts ?? []);
      })
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load control accounts settings')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  async function onSave() {
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    try {
      const res = await updateFinanceApControlAccount({ apControlAccountId: apControlAccountId.trim() });
      setApControlAccountId(String(res?.apControlAccountId ?? apControlAccountId));
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return <div style={{ color: 'crimson' }}>Access denied</div>;

  return (
    <div>
      <SettingsPageHeader
        title="Control Accounts"
        subtitle="This account is used as the Accounts Payable control account when posting supplier bills."
        rightSlot={
          <>
            <button type="button" onClick={() => load()} disabled={saving}>
              Reload
            </button>
            <button type="button" onClick={() => void onSave()} disabled={saving || !apControlAccountId.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />

      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading ? (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center', maxWidth: 860 }}>
          <div>AP Control Account</div>
          <select value={apControlAccountId} onChange={(e) => setApControlAccountId(e.target.value)} disabled={saving}>
            <option value="">Select...</option>
            {liabilityAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>

          <div />
          <div />
        </div>
      ) : null}
    </div>
  );
}
