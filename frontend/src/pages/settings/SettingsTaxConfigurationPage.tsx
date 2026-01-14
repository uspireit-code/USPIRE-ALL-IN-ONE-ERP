import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { getApiErrorMessage } from '../../services/api';
import type { CoaAccount } from '../../services/coa';
import { listCoa } from '../../services/coa';
import type { TenantTaxConfig } from '../../services/tax';
import { getTenantTaxConfig, updateTenantTaxConfig } from '../../services/tax';

export function SettingsTaxConfigurationPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission(PERMISSIONS.TAX.RATE_VIEW);
  const canUpdate = hasPermission(PERMISSIONS.TAX.CONFIG_UPDATE);

  const [coa, setCoa] = useState<CoaAccount[]>([]);
  const [cfg, setCfg] = useState<TenantTaxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [outputVatAccountId, setOutputVatAccountId] = useState<string>('');
  const [inputVatAccountId, setInputVatAccountId] = useState<string>('');

  const liabilityAccounts = useMemo(() => {
    return (coa ?? [])
      .filter((a) => a.isActive && a.type === 'LIABILITY')
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [coa]);

  const assetAccounts = useMemo(() => {
    return (coa ?? [])
      .filter((a) => a.isActive && a.type === 'ASSET')
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [coa]);

  const load = () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    Promise.all([getTenantTaxConfig(), listCoa()])
      .then(([c, coaRes]) => {
        setCfg(c);
        setCoa(coaRes?.accounts ?? []);
        setOutputVatAccountId(String(c?.outputVatAccountId ?? ''));
        setInputVatAccountId(String(c?.inputVatAccountId ?? ''));
      })
      .catch((e: any) => setError(getApiErrorMessage(e, 'Failed to load tax configuration')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function onSave() {
    if (!canUpdate) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateTenantTaxConfig({
        outputVatAccountId: outputVatAccountId.trim() ? outputVatAccountId.trim() : null,
        inputVatAccountId: inputVatAccountId.trim() ? inputVatAccountId.trim() : null,
      });
      setCfg(updated);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  if (!canView) return <div style={{ color: 'crimson' }}>Access denied</div>;

  return (
    <div>
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/settings">Back to Settings</Link>
      </div>

      <div>
        <h2 style={{ margin: 0 }}>Tax Configuration</h2>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: '18px', color: 'rgba(11,12,30,0.62)' }}>
          Configure tenant VAT control accounts. Taxable invoices cannot be posted until Output VAT is set.
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div style={{ color: 'crimson', marginTop: 10 }}>{error}</div> : null}

      {!loading ? (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center', maxWidth: 860 }}>
          <div>Output VAT (Payable) Account</div>
          <select value={outputVatAccountId} onChange={(e) => setOutputVatAccountId(e.target.value)} disabled={saving || !canUpdate}>
            <option value="">Select...</option>
            {liabilityAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>

          <div>Input VAT (Recoverable) Account</div>
          <select value={inputVatAccountId} onChange={(e) => setInputVatAccountId(e.target.value)} disabled={saving || !canUpdate}>
            <option value="">(Optional)</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>

          <div />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => load()} disabled={saving}>
              Reload
            </button>
            {canUpdate ? (
              <button type="button" onClick={() => void onSave()} disabled={saving || !outputVatAccountId.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>

          <div />
          <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>
            Current: Output VAT = {cfg?.outputVatAccount ? `${cfg.outputVatAccount.code} - ${cfg.outputVatAccount.name}` : cfg?.outputVatAccountId ? cfg.outputVatAccountId : 'Not set'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
