import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { tokens } from '../../designTokens';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { getApiErrorMessage } from '../../services/api';
import {
  getFinancialGovernance,
  updateFinancialGovernance,
  type FinancialGovernanceSettings,
} from '../../services/settings';
import { listGlAccounts, type GlAccountLookup } from '../../services/gl';

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>{props.label}</div>
      <div style={{ marginTop: 6 }}>{props.children}</div>
      {props.hint ? <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>{props.hint}</div> : null}
    </div>
  );
}

export function SettingsFinancialGovernancePage() {
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.FINANCE.CONFIG_VIEW) ||
    hasPermission(PERMISSIONS.FINANCE.VIEW_ALL) ||
    hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.FINANCE.CONFIG_CHANGE);

  const canUpdate =
    hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.FINANCE.CONFIG_CHANGE);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [finance, setFinance] = useState<FinancialGovernanceSettings | null>(null);

  const [allowSelfPosting, setAllowSelfPosting] = useState(true);
  const [journalNumberingScope, setJournalNumberingScope] = useState<
    'TENANT_GLOBAL' | 'LEGAL_ENTITY' | 'FISCAL_YEAR' | 'LEGAL_ENTITY_FISCAL_YEAR'
  >('TENANT_GLOBAL');
  const [requiresDepartmentOnInvoices, setRequiresDepartmentOnInvoices] = useState(false);
  const [requiresProjectOnInvoices, setRequiresProjectOnInvoices] = useState(false);
  const [requiresFundOnInvoices, setRequiresFundOnInvoices] = useState(false);

  const [arControlAccountId, setArControlAccountId] = useState<string>('');
  const [apControlAccountId, setApControlAccountId] = useState<string>('');
  const [defaultBankClearingAccountId, setDefaultBankClearingAccountId] = useState<string>('');
  const [arRefundClearingAccountId, setArRefundClearingAccountId] = useState<string>('');
  const [cashClearingAccountId, setCashClearingAccountId] = useState<string>('');
  const [arCashClearingAccountId, setArCashClearingAccountId] = useState<string>('');
  const [unappliedReceiptsAccountId, setUnappliedReceiptsAccountId] = useState<string>('');

  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);

  async function refresh() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const s = await getFinancialGovernance();
      setFinance(s);

      setAllowSelfPosting(s.allowSelfPosting === undefined ? true : Boolean(s.allowSelfPosting));
      setJournalNumberingScope(
        (s.journalNumberingScope ?? 'TENANT_GLOBAL') as any,
      );
      setRequiresDepartmentOnInvoices(Boolean(s.requiresDepartmentOnInvoices));
      setRequiresProjectOnInvoices(Boolean(s.requiresProjectOnInvoices));
      setRequiresFundOnInvoices(Boolean(s.requiresFundOnInvoices));

      setArControlAccountId(s.arControlAccountId ?? '');
      setApControlAccountId(s.apControlAccountId ?? '');
      setDefaultBankClearingAccountId(s.defaultBankClearingAccountId ?? '');
      setArRefundClearingAccountId(s.arRefundClearingAccountId ?? '');
      setCashClearingAccountId(s.cashClearingAccountId ?? '');
      setArCashClearingAccountId(s.arCashClearingAccountId ?? '');
      setUnappliedReceiptsAccountId(s.unappliedReceiptsAccountId ?? '');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load financial governance settings'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadAccounts() {
      setAccountsError(null);
      setAccountsLoading(true);
      try {
        const rows = await listGlAccounts();
        if (!mounted) return;
        setAccounts(rows ?? []);
      } catch (e) {
        if (!mounted) return;
        setAccountsError(getApiErrorMessage(e, 'Failed to load GL accounts'));
      } finally {
        if (!mounted) return;
        setAccountsLoading(false);
      }
    }
    void loadAccounts();
    return () => {
      mounted = false;
    };
  }, []);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts]);

  const isDirty = useMemo(() => {
    if (!finance) return false;
    return (
      (finance.allowSelfPosting === undefined ? true : Boolean(finance.allowSelfPosting)) !== allowSelfPosting ||
      String(finance.journalNumberingScope ?? 'TENANT_GLOBAL') !== String(journalNumberingScope) ||
      Boolean(finance.requiresDepartmentOnInvoices ?? false) !== requiresDepartmentOnInvoices ||
      Boolean(finance.requiresProjectOnInvoices ?? false) !== requiresProjectOnInvoices ||
      Boolean(finance.requiresFundOnInvoices ?? false) !== requiresFundOnInvoices ||
      (finance.arControlAccountId ?? '') !== arControlAccountId.trim() ||
      (finance.apControlAccountId ?? '') !== apControlAccountId.trim() ||
      (finance.defaultBankClearingAccountId ?? '') !== defaultBankClearingAccountId.trim() ||
      (finance.arRefundClearingAccountId ?? '') !== arRefundClearingAccountId.trim() ||
      (finance.cashClearingAccountId ?? '') !== cashClearingAccountId.trim() ||
      (finance.arCashClearingAccountId ?? '') !== arCashClearingAccountId.trim() ||
      (finance.unappliedReceiptsAccountId ?? '') !== unappliedReceiptsAccountId.trim()
    );
  }, [
    allowSelfPosting,
    journalNumberingScope,
    apControlAccountId,
    arCashClearingAccountId,
    arControlAccountId,
    arRefundClearingAccountId,
    cashClearingAccountId,
    defaultBankClearingAccountId,
    finance,
    requiresDepartmentOnInvoices,
    requiresFundOnInvoices,
    requiresProjectOnInvoices,
    unappliedReceiptsAccountId,
  ]);

  async function onCancel() {
    if (!finance) return;
    const ok = isDirty ? window.confirm('Discard unsaved changes?') : true;
    if (!ok) return;
    await refresh();
  }

  async function onSave() {
    if (!finance) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = {
        allowSelfPosting,
        journalNumberingScope,
        requiresDepartmentOnInvoices,
        requiresProjectOnInvoices,
        requiresFundOnInvoices,
        arControlAccountId: arControlAccountId.trim() ? arControlAccountId.trim() : null,
        apControlAccountId: apControlAccountId.trim() ? apControlAccountId.trim() : null,
        defaultBankClearingAccountId: defaultBankClearingAccountId.trim() ? defaultBankClearingAccountId.trim() : null,
        arRefundClearingAccountId: arRefundClearingAccountId.trim() ? arRefundClearingAccountId.trim() : null,
        cashClearingAccountId: cashClearingAccountId.trim() ? cashClearingAccountId.trim() : null,
        arCashClearingAccountId: arCashClearingAccountId.trim() ? arCashClearingAccountId.trim() : null,
        unappliedReceiptsAccountId: unappliedReceiptsAccountId.trim() ? unappliedReceiptsAccountId.trim() : null,
      };

      const saved = await updateFinancialGovernance(payload);
      setFinance(saved);
      setSuccess('Financial governance saved.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save financial governance'));
    } finally {
      setSaving(false);
    }
  }

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  if (!canView) {
    return (
      <Alert tone="error" title="Access denied">
        You do not have permission to view financial governance settings.
      </Alert>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="Financial Governance"
        subtitle="Tenant-level financial controls, required posting accounts, and segregation-of-duties rules."
        rightSlot={
          <>
            <Button variant="secondary" disabled={loading || saving || !finance} onClick={() => void onCancel()}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={loading || saving || !finance || !isDirty || !canUpdate}
              onClick={() => void onSave()}
              title={!isDirty ? 'No changes to save' : undefined}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      />

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Action failed">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success" title="Saved">
            {success}
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Alert tone="warning" title="Safety & governance">
          Financial governance changes impact posting and segregation-of-duties. Make changes deliberately.
        </Alert>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Card title="Posting controls" subtitle="Segregation-of-duties and invoice dimensional requirements" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={allowSelfPosting}
                disabled={loading || !finance}
                onChange={(e) => setAllowSelfPosting(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Allow self-posting</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>If disabled, users cannot post receipts they prepared (segregation of duties).</div>
              </div>
            </label>

            <Field
              label="Journal numbering scope"
              hint="Controls whether journal numbers are tenant-global, legal entity scoped, fiscal year scoped, or both."
            >
              <select
                value={journalNumberingScope}
                onChange={(e) => setJournalNumberingScope(e.currentTarget.value as any)}
                disabled={loading || !finance || !canUpdate}
                style={{ width: '100%', padding: 10, borderRadius: 10 }}
              >
                <option value="TENANT_GLOBAL">TENANT_GLOBAL</option>
                <option value="LEGAL_ENTITY">LEGAL_ENTITY</option>
                <option value="FISCAL_YEAR">FISCAL_YEAR</option>
                <option value="LEGAL_ENTITY_FISCAL_YEAR">LEGAL_ENTITY_FISCAL_YEAR</option>
              </select>
            </Field>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={requiresDepartmentOnInvoices}
                disabled={loading || !finance}
                onChange={(e) => setRequiresDepartmentOnInvoices(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Require department on invoices</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>Invoice posting will require a department dimension.</div>
              </div>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={requiresProjectOnInvoices}
                disabled={loading || !finance}
                onChange={(e) => setRequiresProjectOnInvoices(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Require project on invoices</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>Invoice posting will require a project dimension.</div>
              </div>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={requiresFundOnInvoices}
                disabled={loading || !finance}
                onChange={(e) => setRequiresFundOnInvoices(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Require fund on invoices</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>Invoice posting will require a fund dimension.</div>
              </div>
            </label>
          </div>
        </Card>

        <Card title="Control accounts" subtitle="Accounts required for posting operations" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
          <div style={{ display: 'grid', gap: 12 }}>
            {accountsError ? (
              <Alert tone="error" title="GL accounts unavailable">
                {accountsError}
              </Alert>
            ) : null}

            <Field label="Accounts Receivable (AR) Control Account" hint="Required to post customer receipts. Asset accounts only.">
              <select
                value={arControlAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setArControlAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
              {arControlAccountId && accountById.get(arControlAccountId) ? (
                <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                  Selected: {accountById.get(arControlAccountId)?.code} – {accountById.get(arControlAccountId)?.name}
                </div>
              ) : null}
            </Field>

            <Field label="Accounts Payable (AP) Control Account" hint="Required to post supplier bills. Liability accounts only.">
              <select
                value={apControlAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setApControlAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'LIABILITY')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
              {apControlAccountId && accountById.get(apControlAccountId) ? (
                <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                  Selected: {accountById.get(apControlAccountId)?.code} – {accountById.get(apControlAccountId)?.name}
                </div>
              ) : null}
            </Field>

            <Field label="Default Bank Clearing Account" hint="Required to post customer receipts. Asset accounts only.">
              <select
                value={defaultBankClearingAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setDefaultBankClearingAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="AR Refund Clearing Account" hint="Required to post BANK refunds. Asset accounts only.">
              <select
                value={arRefundClearingAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setArRefundClearingAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Cash Clearing Account" hint="Used for cash clearing. Asset accounts only.">
              <select
                value={cashClearingAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setCashClearingAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="AR Cash Clearing Account" hint="Required to post CASH refunds. Asset accounts only.">
              <select
                value={arCashClearingAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setArCashClearingAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Unapplied Receipts Account" hint="Account used when receipts are not yet applied. Asset accounts only.">
              <select
                value={unappliedReceiptsAccountId}
                disabled={accountsLoading || !!accountsError || loading || saving || !finance}
                onChange={(e) => setUnappliedReceiptsAccountId(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(None)</option>
                {(accounts ?? [])
                  .filter((a) => a.isActive && a.type === 'ASSET')
                  .slice(0, 500)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} – {a.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
