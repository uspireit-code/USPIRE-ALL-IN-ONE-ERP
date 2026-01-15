import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import type { TenantSystemConfig } from '../../services/settings';
import { getSystemConfig, updateSystemConfig, uploadSystemFavicon } from '../../services/settings';
import { roleDisplayMap } from '../../roleDisplayMap';
import { useBrandColors, useBranding } from '../../branding/BrandingContext';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { setupTaxControlAccounts, type SetupTaxControlAccountsResponse } from '../../services/coa';
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

export function SettingsSystemPage() {
  const { setPreviewOverrides, clearPreviewOverrides, refresh: refreshBranding } = useBranding();
  const brand = useBrandColors();
  const { hasPermission } = useAuth();
  const canSystemConfigView =
    hasPermission(PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_VIEW) ||
    hasPermission(PERMISSIONS.FINANCE.CONFIG_VIEW) ||
    hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);
  const canSystemConfigUpdate = hasPermission(PERMISSIONS.SYSTEM.CONFIG_UPDATE);
  const canFinanceConfigChange = hasPermission(PERMISSIONS.FINANCE.CONFIG_UPDATE);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [system, setSystem] = useState<TenantSystemConfig | null>(null);

  if (!canSystemConfigView) {
    return <Alert kind="error" title="Access denied" message="You do not have permission to view system settings." />;
  }

  const [organisationName, setOrganisationName] = useState('');
  const [organisationShortName, setOrganisationShortName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [country, setCountry] = useState('');

  const [timezone, setTimezone] = useState('');
  const [financialYearStartMonth, setFinancialYearStartMonth] = useState('');
  const [dateFormat, setDateFormat] = useState('');
  const [numberFormat, setNumberFormat] = useState('');

  const [defaultLandingPage, setDefaultLandingPage] = useState('');
  const [defaultDashboard, setDefaultDashboard] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [defaultUserRoleCode, setDefaultUserRoleCode] = useState('');
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

  const [primaryColor, setPrimaryColor] = useState('#020445');
  const [accentColor, setAccentColor] = useState('#EDBA35');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [secondaryAccentColor, setSecondaryAccentColor] = useState('');

  const [allowSelfPosting, setAllowSelfPosting] = useState(true);

  const [receiptBankName, setReceiptBankName] = useState('');
  const [receiptBankAccountName, setReceiptBankAccountName] = useState('');
  const [receiptBankAccountNumber, setReceiptBankAccountNumber] = useState('');
  const [receiptBankBranch, setReceiptBankBranch] = useState('');
  const [receiptBankSwiftCode, setReceiptBankSwiftCode] = useState('');

  const [requiresDepartmentOnInvoices, setRequiresDepartmentOnInvoices] = useState(false);
  const [requiresProjectOnInvoices, setRequiresProjectOnInvoices] = useState(false);
  const [requiresFundOnInvoices, setRequiresFundOnInvoices] = useState(false);

  const [defaultBankClearingAccountId, setDefaultBankClearingAccountId] = useState<string>('');
  const [bankClearingSearch, setBankClearingSearch] = useState('');
  const [bankClearingPickerOpen, setBankClearingPickerOpen] = useState(false);

  const [arRefundClearingAccountId, setArRefundClearingAccountId] = useState<string>('');
  const [arRefundClearingSearch, setArRefundClearingSearch] = useState('');
  const [arRefundClearingPickerOpen, setArRefundClearingPickerOpen] = useState(false);

  const [arCashClearingAccountId, setArCashClearingAccountId] = useState<string>('');
  const [arCashClearingSearch, setArCashClearingSearch] = useState('');
  const [arCashClearingPickerOpen, setArCashClearingPickerOpen] = useState(false);

  const [arControlAccountId, setArControlAccountId] = useState<string>('');
  const [arControlSearch, setArControlSearch] = useState('');
  const [arControlPickerOpen, setArControlPickerOpen] = useState(false);

  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);

  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const [coaActionLoading, setCoaActionLoading] = useState(false);
  const [coaActionError, setCoaActionError] = useState<string | null>(null);
  const [coaActionResult, setCoaActionResult] = useState<SetupTaxControlAccountsResponse | null>(null);

  async function refresh() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const s = await getSystemConfig();
      setSystem(s);

      setOrganisationName(s.organisationName ?? '');
      setOrganisationShortName(s.organisationShortName ?? '');
      setLegalName(s.legalName ?? '');
      setDefaultCurrency(s.defaultCurrency ?? '');
      setCountry(s.country ?? '');

      setTimezone(s.timezone ?? '');
      setFinancialYearStartMonth(s.financialYearStartMonth ? String(s.financialYearStartMonth) : '');
      setDateFormat(s.dateFormat ?? '');
      setNumberFormat(s.numberFormat ?? '');

      setDefaultLandingPage(s.defaultLandingPage ?? '');
      setDefaultDashboard(s.defaultDashboard ?? '');
      setDefaultLanguage(s.defaultLanguage ?? '');
      setDefaultUserRoleCode(s.defaultUserRoleCode ?? '');
      setDemoModeEnabled(Boolean(s.demoModeEnabled));

      setPrimaryColor(s.primaryColor || '#020445');
      setAccentColor(s.accentColor || '#EDBA35');
      setSecondaryColor(s.secondaryColor ?? '');
      setSecondaryAccentColor(s.secondaryAccentColor ?? '');

      setAllowSelfPosting(s.allowSelfPosting === undefined ? true : Boolean(s.allowSelfPosting));

      setReceiptBankName(s.receiptBankName ?? '');
      setReceiptBankAccountName(s.receiptBankAccountName ?? '');
      setReceiptBankAccountNumber(s.receiptBankAccountNumber ?? '');
      setReceiptBankBranch(s.receiptBankBranch ?? '');
      setReceiptBankSwiftCode(s.receiptBankSwiftCode ?? '');

      setRequiresDepartmentOnInvoices(Boolean(s.requiresDepartmentOnInvoices));
      setRequiresProjectOnInvoices(Boolean(s.requiresProjectOnInvoices));
      setRequiresFundOnInvoices(Boolean(s.requiresFundOnInvoices));

      setDefaultBankClearingAccountId(s.defaultBankClearingAccountId ?? '');
      setBankClearingSearch('');
      setBankClearingPickerOpen(false);

      setArRefundClearingAccountId(s.arRefundClearingAccountId ?? '');
      setArRefundClearingSearch('');
      setArRefundClearingPickerOpen(false);

      setArCashClearingAccountId(s.arCashClearingAccountId ?? '');
      setArCashClearingSearch('');
      setArCashClearingPickerOpen(false);

      setArControlAccountId(s.arControlAccountId ?? '');
      setArControlSearch('');
      setArControlPickerOpen(false);

      setPendingFaviconFile(null);
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      clearPreviewOverrides();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load system configuration'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    return () => {
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
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
  const selectedBankClearingAccount = defaultBankClearingAccountId
    ? accountById.get(defaultBankClearingAccountId)
    : undefined;

  const selectedArRefundClearingAccount = arRefundClearingAccountId
    ? accountById.get(arRefundClearingAccountId)
    : undefined;

  const selectedArCashClearingAccount = arCashClearingAccountId
    ? accountById.get(arCashClearingAccountId)
    : undefined;

  const selectedArControlAccount = arControlAccountId ? accountById.get(arControlAccountId) : undefined;

  const bankClearingCandidates = useMemo(() => {
    const q = bankClearingSearch.trim().toLowerCase();
    const base = (accounts ?? []).filter((a) => a.isActive && a.type === 'ASSET');
    if (!q) return base.slice(0, 12);
    const filtered = base.filter((a) => {
      const code = String(a.code ?? '').toLowerCase();
      const name = String(a.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    return filtered.slice(0, 12);
  }, [accounts, bankClearingSearch]);

  const arRefundClearingCandidates = useMemo(() => {
    const q = arRefundClearingSearch.trim().toLowerCase();
    const base = (accounts ?? []).filter((a) => a.isActive && a.type === 'ASSET');
    if (!q) return base.slice(0, 12);
    const filtered = base.filter((a) => {
      const code = String(a.code ?? '').toLowerCase();
      const name = String(a.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    return filtered.slice(0, 12);
  }, [accounts, arRefundClearingSearch]);

  const arCashClearingCandidates = useMemo(() => {
    const q = arCashClearingSearch.trim().toLowerCase();
    const base = (accounts ?? []).filter((a) => a.isActive && a.type === 'ASSET');
    if (!q) return base.slice(0, 12);
    const filtered = base.filter((a) => {
      const code = String(a.code ?? '').toLowerCase();
      const name = String(a.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    return filtered.slice(0, 12);
  }, [accounts, arCashClearingSearch]);

  const arControlCandidates = useMemo(() => {
    const q = arControlSearch.trim().toLowerCase();
    const base = (accounts ?? []).filter((a) => a.isActive && a.type === 'ASSET');
    if (!q) return base.slice(0, 12);
    const filtered = base.filter((a) => {
      const code = String(a.code ?? '').toLowerCase();
      const name = String(a.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    return filtered.slice(0, 12);
  }, [accounts, arControlSearch]);

  useEffect(() => {
    setPreviewOverrides({
      organisationName: organisationName.trim() || undefined,
      organisationShortName: organisationShortName.trim() || undefined,
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      accentColor: accentColor || undefined,
      secondaryAccentColor: secondaryAccentColor || undefined,
      faviconUrl: faviconPreviewUrl || undefined,
    });
  }, [accentColor, faviconPreviewUrl, organisationName, organisationShortName, primaryColor, secondaryAccentColor, secondaryColor, setPreviewOverrides]);

  const isDirty = useMemo(() => {
    if (!system) return false;
    return (
      organisationName.trim() !== (system.organisationName ?? '') ||
      organisationShortName.trim() !== (system.organisationShortName ?? '') ||
      legalName.trim() !== (system.legalName ?? '') ||
      defaultCurrency.trim() !== (system.defaultCurrency ?? '') ||
      country.trim() !== (system.country ?? '') ||
      timezone.trim() !== (system.timezone ?? '') ||
      (financialYearStartMonth.trim() ? Number(financialYearStartMonth) : null) !== (system.financialYearStartMonth ?? null) ||
      dateFormat.trim() !== (system.dateFormat ?? '') ||
      numberFormat.trim() !== (system.numberFormat ?? '') ||
      defaultLandingPage.trim() !== (system.defaultLandingPage ?? '') ||
      defaultDashboard.trim() !== (system.defaultDashboard ?? '') ||
      defaultLanguage.trim() !== (system.defaultLanguage ?? '') ||
      defaultUserRoleCode.trim() !== (system.defaultUserRoleCode ?? '') ||
      Boolean(demoModeEnabled) !== Boolean(system.demoModeEnabled) ||
      primaryColor.trim() !== (system.primaryColor ?? '#020445') ||
      (system.accentColor ?? '') !== accentColor.trim() ||
      (system.secondaryColor ?? '') !== secondaryColor.trim() ||
      (system.secondaryAccentColor ?? '') !== secondaryAccentColor.trim() ||
      Boolean(system.allowSelfPosting === undefined ? true : system.allowSelfPosting) !== Boolean(allowSelfPosting) ||
      (system.receiptBankName ?? '') !== receiptBankName.trim() ||
      (system.receiptBankAccountName ?? '') !== receiptBankAccountName.trim() ||
      (system.receiptBankAccountNumber ?? '') !== receiptBankAccountNumber.trim() ||
      (system.receiptBankBranch ?? '') !== receiptBankBranch.trim() ||
      (system.receiptBankSwiftCode ?? '') !== receiptBankSwiftCode.trim() ||
      Boolean(system.requiresDepartmentOnInvoices) !== Boolean(requiresDepartmentOnInvoices) ||
      Boolean(system.requiresProjectOnInvoices ?? false) !== requiresProjectOnInvoices ||
      (system.requiresFundOnInvoices ?? false) !== requiresFundOnInvoices ||
      (system.arControlAccountId ?? '') !== arControlAccountId.trim() ||
      (system.defaultBankClearingAccountId ?? '') !== defaultBankClearingAccountId.trim() ||
      (system.arRefundClearingAccountId ?? '') !== arRefundClearingAccountId.trim() ||
      (system.arCashClearingAccountId ?? '') !== arCashClearingAccountId.trim() ||
      Boolean(pendingFaviconFile)
    );
  }, [
    accentColor,
    allowSelfPosting,
    arCashClearingAccountId,
    arControlAccountId,
    arRefundClearingAccountId,
    country,
    dateFormat,
    defaultBankClearingAccountId,
    defaultCurrency,
    defaultDashboard,
    defaultLandingPage,
    defaultLanguage,
    defaultUserRoleCode,
    demoModeEnabled,
    financialYearStartMonth,
    legalName,
    numberFormat,
    organisationName,
    organisationShortName,
    pendingFaviconFile,
    primaryColor,
    receiptBankAccountName,
    receiptBankAccountNumber,
    receiptBankBranch,
    receiptBankName,
    receiptBankSwiftCode,
    requiresDepartmentOnInvoices,
    requiresFundOnInvoices,
    requiresProjectOnInvoices,
    secondaryAccentColor,
    secondaryColor,
    system,
    timezone,
  ]);

  async function onPickFavicon() {
    faviconInputRef.current?.click();
  }

  async function onFaviconSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    setSuccess(null);
    setError(null);
    setPendingFaviconFile(file);

    const url = URL.createObjectURL(file);
    setFaviconPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  async function onCancel() {
    if (!system) return;
    const ok = isDirty ? window.confirm('Discard unsaved changes?') : true;
    if (!ok) return;
    await refresh();
  }

  async function onSave() {
    if (!system) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (pendingFaviconFile) {
        await uploadSystemFavicon(pendingFaviconFile);
      }

      const fy = financialYearStartMonth.trim() ? Number(financialYearStartMonth) : null;

      const updated = await updateSystemConfig({
        organisationName: organisationName.trim(),
        organisationShortName: organisationShortName.trim() ? organisationShortName.trim() : null,
        legalName: legalName.trim() ? legalName.trim() : null,
        defaultCurrency: defaultCurrency.trim() ? defaultCurrency.trim() : null,
        country: country.trim() ? country.trim() : null,
        timezone: timezone.trim() ? timezone.trim() : null,
        financialYearStartMonth: Number.isFinite(fy as any) ? fy : null,
        dateFormat: dateFormat.trim() ? dateFormat.trim() : null,
        numberFormat: numberFormat.trim() ? numberFormat.trim() : null,
        defaultLandingPage: defaultLandingPage.trim() ? defaultLandingPage.trim() : null,
        defaultDashboard: defaultDashboard.trim() ? defaultDashboard.trim() : null,
        defaultLanguage: defaultLanguage.trim() ? defaultLanguage.trim() : null,
        demoModeEnabled,
        defaultUserRoleCode: defaultUserRoleCode.trim() ? defaultUserRoleCode.trim() : null,
        primaryColor: primaryColor.trim() || '#020445',
        secondaryColor: secondaryColor.trim() ? secondaryColor.trim() : null,
        accentColor: accentColor.trim() ? accentColor.trim() : null,
        secondaryAccentColor: secondaryAccentColor.trim() ? secondaryAccentColor.trim() : null,
        allowSelfPosting,
        receiptBankName: receiptBankName.trim() ? receiptBankName.trim() : null,
        receiptBankAccountName: receiptBankAccountName.trim() ? receiptBankAccountName.trim() : null,
        receiptBankAccountNumber: receiptBankAccountNumber.trim() ? receiptBankAccountNumber.trim() : null,
        receiptBankBranch: receiptBankBranch.trim() ? receiptBankBranch.trim() : null,
        receiptBankSwiftCode: receiptBankSwiftCode.trim() ? receiptBankSwiftCode.trim() : null,
        requiresDepartmentOnInvoices,
        requiresProjectOnInvoices,
        requiresFundOnInvoices,
        arControlAccountId: arControlAccountId.trim() ? arControlAccountId.trim() : null,
        defaultBankClearingAccountId: defaultBankClearingAccountId.trim() ? defaultBankClearingAccountId.trim() : null,
        arRefundClearingAccountId: arRefundClearingAccountId.trim() ? arRefundClearingAccountId.trim() : null,
        arCashClearingAccountId: arCashClearingAccountId.trim() ? arCashClearingAccountId.trim() : null,
      });

      setSystem(updated);
      setPendingFaviconFile(null);
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      clearPreviewOverrides();
      await refreshBranding();
      setSuccess('System configuration saved. Some changes may require users to re-login.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save system configuration'));
    } finally {
      setSaving(false);
    }
  }

  const defaultRoleOptions = Object.entries(roleDisplayMap)
    .filter(([code]) => code !== 'ADMIN')
    .map(([code, info]) => ({ code, label: info.label }));

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  async function onSetupTaxControlAccounts() {
    setCoaActionError(null);
    setCoaActionResult(null);
    setCoaActionLoading(true);
    try {
      const res = await setupTaxControlAccounts();
      setCoaActionResult(res);
    } catch (e) {
      setCoaActionError(getApiErrorMessage(e, 'Failed to setup tax control accounts'));
    } finally {
      setCoaActionLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, color: '#0B0C1E' }}>System Configuration</div>
          <div style={{ marginTop: 10, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px', maxWidth: 820 }}>
            Changes here affect the entire tenant. Branding previews apply immediately, but only persist after you click Save Changes.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="secondary" disabled={loading || saving || !system} onClick={() => void onCancel()}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={loading || saving || !system || !isDirty || !organisationName.trim() || !canSystemConfigUpdate}
            onClick={() => void onSave()}
            title={!organisationName.trim() ? 'Organisation name is required' : !isDirty ? 'No changes to save' : undefined}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

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
          Changes here affect the entire tenant. Some changes may require users to re-login to see updates consistently.
        </Alert>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Card
          title="Organisation Identity"
          subtitle="Tenant-level identity fields"
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Organisation / Tenant Name">
              <Input value={organisationName} disabled={loading || !system} onChange={(e) => setOrganisationName(e.target.value)} />
            </Field>
            <Field label="Legal Name" hint="Used for legal documents and audit references.">
              <Input value={legalName} disabled={loading || !system} onChange={(e) => setLegalName(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Short Name" hint="Shown in compact areas like the sidebar header.">
              <Input value={organisationShortName} disabled={loading || !system} onChange={(e) => setOrganisationShortName(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Default Currency" hint="For display defaults (new records).">
              <Input value={defaultCurrency} disabled={loading || !system} onChange={(e) => setDefaultCurrency(e.target.value)} placeholder="e.g. ZAR" />
            </Field>
            <Field label="Country">
              <Input value={country} disabled={loading || !system} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. ZA" />
            </Field>
          </div>
        </Card>

        <Card
          title="Locale & Formats"
          subtitle="How dates and numbers are displayed"
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Timezone">
              <Input value={timezone} disabled={loading || !system} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Africa/Johannesburg" />
            </Field>
            <Field label="Financial Year Start Month" hint="1 = January, 12 = December">
              <Input value={financialYearStartMonth} disabled={loading || !system} onChange={(e) => setFinancialYearStartMonth(e.target.value)} placeholder="e.g. 1" inputMode="numeric" />
            </Field>
            <Field label="Date Format" hint="Example: DD/MM/YYYY">
              <Input value={dateFormat} disabled={loading || !system} onChange={(e) => setDateFormat(e.target.value)} placeholder="DD/MM/YYYY" />
            </Field>
            <Field label="Number Format" hint="Example: 1,234.56">
              <Input value={numberFormat} disabled={loading || !system} onChange={(e) => setNumberFormat(e.target.value)} placeholder="1,234.56" />
            </Field>
          </div>
        </Card>

        <Card
          title="System Defaults"
          subtitle="Defaults apply to new users / new setup only"
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Default landing page after login">
              <select
                value={defaultLandingPage}
                disabled={loading || !system}
                onChange={(e) => setDefaultLandingPage(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(Use current system default)</option>
                <option value="/">Dashboard</option>
                <option value="/dashboard">Management Dashboard</option>
              </select>
            </Field>

            <Field label="Default dashboard">
              <select
                value={defaultDashboard}
                disabled={loading || !system}
                onChange={(e) => setDefaultDashboard(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(Use current system default)</option>
                <option value="BASIC">Basic</option>
                <option value="MANAGEMENT">Management</option>
              </select>
            </Field>

            <Field label="Default language">
              <select
                value={defaultLanguage}
                disabled={loading || !system}
                onChange={(e) => setDefaultLanguage(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(Use current system default)</option>
                <option value="en">English</option>
              </select>
            </Field>

            <Field label="Default user role on creation" hint="Applied for new users only. Admin must still assign roles deliberately.">
              <select
                value={defaultUserRoleCode}
                disabled={loading || !system}
                onChange={(e) => setDefaultUserRoleCode(e.currentTarget.value)}
                style={{ width: '100%', height: 40, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.border.default}`, padding: '0 12px' }}
              >
                <option value="">(No default)</option>
                {defaultRoleOptions.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={demoModeEnabled}
                disabled={loading || !system}
                onChange={(e) => setDemoModeEnabled(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Enable demo mode</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>Only affects demo UX features (if present). No accounting data is changed.</div>
              </div>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={allowSelfPosting}
                disabled={loading || !system}
                onChange={(e) => setAllowSelfPosting(e.currentTarget.checked)}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Allow self-posting</div>
                <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>If disabled, users cannot post receipts they prepared (segregation of duties).</div>
              </div>
            </label>

            <div style={{ height: 1, background: tokens.colors.border.subtle }} />

            <div style={{ fontSize: 13, fontWeight: 750, color: tokens.colors.text.primary }}>Receipt export bank details</div>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>These appear on customer receipt exports (HTML/PDF).</div>
            <Field label="Bank name">
              <Input value={receiptBankName} disabled={loading || !system} onChange={(e) => setReceiptBankName(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Account name">
              <Input value={receiptBankAccountName} disabled={loading || !system} onChange={(e) => setReceiptBankAccountName(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Account number">
              <Input value={receiptBankAccountNumber} disabled={loading || !system} onChange={(e) => setReceiptBankAccountNumber(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Branch">
              <Input value={receiptBankBranch} disabled={loading || !system} onChange={(e) => setReceiptBankBranch(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Swift code">
              <Input value={receiptBankSwiftCode} disabled={loading || !system} onChange={(e) => setReceiptBankSwiftCode(e.target.value)} placeholder="Optional" />
            </Field>

            <div style={{ height: 1, background: tokens.colors.border.subtle }} />

            <Field
              label="Default Bank Clearing Account"
              hint="Optional here, but required to post customer receipts. Search by account code or name."
            >
              <div
                style={{ position: 'relative' }}
                onFocus={() => setBankClearingPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setBankClearingPickerOpen(false), 150);
                }}
              >
                <Input
                  value={bankClearingSearch}
                  disabled={loading || saving || !system || accountsLoading}
                  onChange={(e) => {
                    setBankClearingSearch(e.target.value);
                    setBankClearingPickerOpen(true);
                  }}
                  placeholder={
                    selectedBankClearingAccount
                      ? `${selectedBankClearingAccount.code} – ${selectedBankClearingAccount.name}`
                      : 'Search account…'
                  }
                />

                {accountsError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.status.errorBorder }}>
                    {accountsError}
                  </div>
                ) : null}

                {selectedBankClearingAccount ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                      Selected: <b>{selectedBankClearingAccount.code}</b> — {selectedBankClearingAccount.name}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={loading || saving || !system}
                      onClick={() => {
                        setDefaultBankClearingAccountId('');
                        setBankClearingSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}

                {bankClearingPickerOpen && !accountsLoading && bankClearingCandidates.length > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: 10,
                      background: '#fff',
                      boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                      overflow: 'hidden',
                      maxHeight: 280,
                    }}
                  >
                    {bankClearingCandidates.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDefaultBankClearingAccountId(a.id);
                          setBankClearingSearch(`${a.code} – ${a.name}`);
                          setBankClearingPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 0,
                          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary }}>{a.code}</div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{a.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>

            <Field
              label="AR Refund Clearing Account"
              hint="Required to post BANK refunds. This is AR_REFUND_CLEARING_ACCOUNT_ID. Search by account code or name. Asset accounts only."
            >
              <div
                style={{ position: 'relative' }}
                onFocus={() => setArRefundClearingPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setArRefundClearingPickerOpen(false), 150);
                }}
              >
                <Input
                  value={arRefundClearingSearch}
                  disabled={loading || saving || !system || accountsLoading}
                  onChange={(e) => {
                    setArRefundClearingSearch(e.target.value);
                    setArRefundClearingPickerOpen(true);
                  }}
                  placeholder={
                    selectedArRefundClearingAccount
                      ? `${selectedArRefundClearingAccount.code} – ${selectedArRefundClearingAccount.name}`
                      : 'Search account…'
                  }
                />

                {accountsError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.status.errorBorder }}>
                    {accountsError}
                  </div>
                ) : null}

                {selectedArRefundClearingAccount ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                      Selected: <b>{selectedArRefundClearingAccount.code}</b> — {selectedArRefundClearingAccount.name}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={loading || saving || !system}
                      onClick={() => {
                        setArRefundClearingAccountId('');
                        setArRefundClearingSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}

                {arRefundClearingPickerOpen && !accountsLoading && arRefundClearingCandidates.length > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: 10,
                      background: '#fff',
                      boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                      overflow: 'hidden',
                      maxHeight: 280,
                    }}
                  >
                    {arRefundClearingCandidates.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setArRefundClearingAccountId(a.id);
                          setArRefundClearingSearch(`${a.code} – ${a.name}`);
                          setArRefundClearingPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 0,
                          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary }}>{a.code}</div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{a.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>

            <Field
              label="AR Cash Clearing Account"
              hint="Required to post CASH refunds. This is AR_CASH_CLEARING_ACCOUNT_ID. Search by account code or name. Asset accounts only."
            >
              <div
                style={{ position: 'relative' }}
                onFocus={() => setArCashClearingPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setArCashClearingPickerOpen(false), 150);
                }}
              >
                <Input
                  value={arCashClearingSearch}
                  disabled={loading || saving || !system || accountsLoading}
                  onChange={(e) => {
                    setArCashClearingSearch(e.target.value);
                    setArCashClearingPickerOpen(true);
                  }}
                  placeholder={
                    selectedArCashClearingAccount
                      ? `${selectedArCashClearingAccount.code} – ${selectedArCashClearingAccount.name}`
                      : 'Search account…'
                  }
                />

                {accountsError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.status.errorBorder }}>
                    {accountsError}
                  </div>
                ) : null}

                {selectedArCashClearingAccount ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                      Selected: <b>{selectedArCashClearingAccount.code}</b> — {selectedArCashClearingAccount.name}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={loading || saving || !system}
                      onClick={() => {
                        setArCashClearingAccountId('');
                        setArCashClearingSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}

                {arCashClearingPickerOpen && !accountsLoading && arCashClearingCandidates.length > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: 10,
                      background: '#fff',
                      boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                      overflow: 'hidden',
                      maxHeight: 280,
                    }}
                  >
                    {arCashClearingCandidates.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setArCashClearingAccountId(a.id);
                          setArCashClearingSearch(`${a.code} – ${a.name}`);
                          setArCashClearingPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 0,
                          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary }}>{a.code}</div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{a.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>

            <Field
              label="Accounts Receivable (AR) Control Account"
              hint="Required to post customer receipts. Search by account code or name. Asset accounts only."
            >
              <div
                style={{ position: 'relative' }}
                onFocus={() => setArControlPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setArControlPickerOpen(false), 150);
                }}
              >
                <Input
                  value={arControlSearch}
                  disabled={loading || saving || !system || accountsLoading}
                  onChange={(e) => {
                    setArControlSearch(e.target.value);
                    setArControlPickerOpen(true);
                  }}
                  placeholder={selectedArControlAccount ? `${selectedArControlAccount.code} – ${selectedArControlAccount.name}` : 'Search account…'}
                />

                {accountsError ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.status.errorBorder }}>
                    {accountsError}
                  </div>
                ) : null}

                {selectedArControlAccount ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                      Selected: <b>{selectedArControlAccount.code}</b> — {selectedArControlAccount.name}
                    </div>
                    <Button
                      variant="secondary"
                      disabled={loading || saving || !system}
                      onClick={() => {
                        setArControlAccountId('');
                        setArControlSearch('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                ) : null}

                {arControlPickerOpen && !accountsLoading && arControlCandidates.length > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: 10,
                      background: '#fff',
                      boxShadow: '0 10px 24px rgba(11,12,30,0.12)',
                      overflow: 'hidden',
                      maxHeight: 280,
                    }}
                  >
                    {arControlCandidates.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setArControlAccountId(a.id);
                          setArControlSearch(`${a.code} – ${a.name}`);
                          setArControlPickerOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 0,
                          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary }}>{a.code}</div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>{a.name}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>
          </div>
        </Card>

        <Card
          title="Branding"
          subtitle="Live preview in the sidebar, top bar, and login screen"
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Primary brand color">
                <Input type="color" value={primaryColor} disabled={loading || !system} onChange={(e) => setPrimaryColor(e.target.value)} style={{ padding: 0 }} />
              </Field>
              <Field label="Accent color">
                <Input type="color" value={accentColor} disabled={loading || !system} onChange={(e) => setAccentColor(e.target.value)} style={{ padding: 0 }} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Optional secondary color">
                <Input value={secondaryColor} disabled={loading || !system} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="Optional hex" />
              </Field>
              <Field label="Optional secondary accent">
                <Input value={secondaryAccentColor} disabled={loading || !system} onChange={(e) => setSecondaryAccentColor(e.target.value)} placeholder="Optional hex" />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, background: 'rgba(11,12,30,0.02)' }}>
              <div style={{ width: 16, height: 16, borderRadius: 6, background: brand.navy, border: `1px solid ${tokens.colors.border.subtle}` }} />
              <div style={{ width: 16, height: 16, borderRadius: 6, background: brand.gold, border: `1px solid ${tokens.colors.border.subtle}` }} />
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Preview swatches (live)</div>
            </div>

            <div style={{ height: 1, background: tokens.colors.border.subtle }} />

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Favicon</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input ref={faviconInputRef} type="file" accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" onChange={onFaviconSelected} style={{ display: 'none' }} />
                <Button variant="secondary" onClick={() => void onPickFavicon()} disabled={loading || saving || !system}>
                  {pendingFaviconFile ? 'Replace favicon' : 'Upload favicon'}
                </Button>
                <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>PNG / SVG / ICO (max 2MB)</div>
              </div>
              {pendingFaviconFile ? <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.secondary }}>Pending: {pendingFaviconFile.name} (will apply on Save)</div> : null}
            </div>
          </div>
        </Card>

        {canFinanceConfigChange ? (
          <Card
            title="Chart of Accounts"
            subtitle="Admin-only setup actions"
            baseShadow={cardBaseShadow}
            hoverShadow={cardHoverShadow}
            interactive
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
                Use this to create required tax control accounts (VAT/PAYE/WHT) if they are missing. This is safe and idempotent.
              </div>

              {coaActionError ? (
                <Alert tone="error" title="COA setup failed">
                  {coaActionError}
                </Alert>
              ) : null}

              {coaActionResult ? (
                <Alert tone="success" title="COA setup completed">
                  Created: {coaActionResult.createdCount}
                </Alert>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button
                  variant="secondary"
                  disabled={loading || saving || !system || coaActionLoading}
                  onClick={() => void onSetupTaxControlAccounts()}
                >
                  {coaActionLoading ? 'Running…' : 'Setup tax control accounts'}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
