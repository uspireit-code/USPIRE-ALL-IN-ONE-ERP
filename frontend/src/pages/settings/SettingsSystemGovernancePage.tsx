import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { tokens } from '../../designTokens';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { useBrandColors, useBranding } from '../../branding/BrandingContext';
import { getApiErrorMessage } from '../../services/api';
import {
  getSystemGovernance,
  updateSystemGovernance,
  uploadSystemFavicon,
  type SystemGovernanceSettings,
} from '../../services/settings';
import { roleDisplayMap } from '../../roleDisplayMap';

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>{props.label}</div>
      <div style={{ marginTop: 6 }}>{props.children}</div>
      {props.hint ? <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>{props.hint}</div> : null}
    </div>
  );
}

export function SettingsSystemGovernancePage() {
  const { setPreviewOverrides, clearPreviewOverrides, refresh: refreshBranding } = useBranding();
  const brand = useBrandColors();
  const { hasPermission } = useAuth();

  const canView =
    hasPermission(PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_VIEW) ||
    hasPermission((PERMISSIONS as any).GOVERNANCE?.SYSTEM?.VIEW);

  const canUpdate =
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_UPDATE) ||
    hasPermission(PERMISSIONS.SYSTEM.CONFIG_CHANGE);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [system, setSystem] = useState<SystemGovernanceSettings | null>(null);

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

  const [primaryColor, setPrimaryColor] = useState<string>(tokens.brandHex.navy);
  const [accentColor, setAccentColor] = useState<string>(tokens.brandHex.gold);
  const [secondaryColor, setSecondaryColor] = useState('');
  const [secondaryAccentColor, setSecondaryAccentColor] = useState('');

  const [receiptBankName, setReceiptBankName] = useState('');
  const [receiptBankAccountName, setReceiptBankAccountName] = useState('');
  const [receiptBankAccountNumber, setReceiptBankAccountNumber] = useState('');
  const [receiptBankBranch, setReceiptBankBranch] = useState('');
  const [receiptBankSwiftCode, setReceiptBankSwiftCode] = useState('');

  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | undefined>(undefined);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const s = await getSystemGovernance();
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

      setPrimaryColor(s.primaryColor || tokens.brandHex.navy);
      setAccentColor(s.accentColor || tokens.brandHex.gold);
      setSecondaryColor(s.secondaryColor ?? '');
      setSecondaryAccentColor(s.secondaryAccentColor ?? '');

      setReceiptBankName(s.receiptBankName ?? '');
      setReceiptBankAccountName(s.receiptBankAccountName ?? '');
      setReceiptBankAccountNumber(s.receiptBankAccountNumber ?? '');
      setReceiptBankBranch(s.receiptBankBranch ?? '');
      setReceiptBankSwiftCode(s.receiptBankSwiftCode ?? '');

      setPendingFaviconFile(null);
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return undefined;
      });
      clearPreviewOverrides();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load system governance settings'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    return () => {
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return undefined;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [
    accentColor,
    faviconPreviewUrl,
    organisationName,
    organisationShortName,
    primaryColor,
    secondaryAccentColor,
    secondaryColor,
    setPreviewOverrides,
  ]);

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
      primaryColor.trim() !== (system.primaryColor ?? tokens.brandHex.navy) ||
      (system.accentColor ?? '') !== accentColor.trim() ||
      (system.secondaryColor ?? '') !== secondaryColor.trim() ||
      (system.secondaryAccentColor ?? '') !== secondaryAccentColor.trim() ||
      (system.receiptBankName ?? '') !== receiptBankName.trim() ||
      (system.receiptBankAccountName ?? '') !== receiptBankAccountName.trim() ||
      (system.receiptBankAccountNumber ?? '') !== receiptBankAccountNumber.trim() ||
      (system.receiptBankBranch ?? '') !== receiptBankBranch.trim() ||
      (system.receiptBankSwiftCode ?? '') !== receiptBankSwiftCode.trim() ||
      Boolean(pendingFaviconFile)
    );
  }, [
    accentColor,
    country,
    dateFormat,
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

      const payload = {
        organisationName,
        organisationShortName: organisationShortName.trim() ? organisationShortName.trim() : null,
        legalName: legalName.trim() ? legalName.trim() : null,
        defaultCurrency: defaultCurrency.trim() ? defaultCurrency.trim() : null,
        country: country.trim() ? country.trim() : null,
        timezone: timezone.trim() ? timezone.trim() : null,
        financialYearStartMonth: financialYearStartMonth.trim() ? Number(financialYearStartMonth) : null,
        dateFormat: dateFormat.trim() ? dateFormat.trim() : null,
        numberFormat: numberFormat.trim() ? numberFormat.trim() : null,
        defaultLandingPage: defaultLandingPage.trim() ? defaultLandingPage.trim() : null,
        defaultDashboard: defaultDashboard.trim() ? defaultDashboard.trim() : null,
        defaultLanguage: defaultLanguage.trim() ? defaultLanguage.trim() : null,
        defaultUserRoleCode: defaultUserRoleCode.trim() ? defaultUserRoleCode.trim() : null,
        demoModeEnabled,
        primaryColor,
        accentColor,
        secondaryColor: secondaryColor.trim() ? secondaryColor.trim() : null,
        secondaryAccentColor: secondaryAccentColor.trim() ? secondaryAccentColor.trim() : null,
        receiptBankName: receiptBankName.trim() ? receiptBankName.trim() : null,
        receiptBankAccountName: receiptBankAccountName.trim() ? receiptBankAccountName.trim() : null,
        receiptBankAccountNumber: receiptBankAccountNumber.trim() ? receiptBankAccountNumber.trim() : null,
        receiptBankBranch: receiptBankBranch.trim() ? receiptBankBranch.trim() : null,
        receiptBankSwiftCode: receiptBankSwiftCode.trim() ? receiptBankSwiftCode.trim() : null,
      };

      const saved = await updateSystemGovernance(payload);

      setSystem(saved);
      setPendingFaviconFile(null);
      setFaviconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return undefined;
      });
      clearPreviewOverrides();
      await refreshBranding();
      setSuccess('System governance saved. Some changes may require users to re-login.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save system governance'));
    } finally {
      setSaving(false);
    }
  }

  const defaultRoleOptions = Object.entries(roleDisplayMap)
    .filter(([code]) => code !== 'ADMIN')
    .map(([code, info]) => ({ code, label: info.label }));

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  if (!canView) {
    return (
      <Alert tone="error" title="Access denied">
        You do not have permission to view system governance settings.
      </Alert>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="System Governance"
        subtitle="Tenant-level system configuration and branding. Changes apply across the whole tenant."
        rightSlot={
          <>
            <Button variant="secondary" disabled={loading || saving || !system} onClick={() => void onCancel()}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={loading || saving || !system || !isDirty || !organisationName.trim() || !canUpdate}
              onClick={() => void onSave()}
              title={!organisationName.trim() ? 'Organisation name is required' : !isDirty ? 'No changes to save' : undefined}
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
          Changes here affect the entire tenant. Some changes may require users to re-login to see updates consistently.
        </Alert>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Card title="Organisation Identity" subtitle="Tenant-level identity fields" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
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

        <Card title="Locale & Formats" subtitle="How dates and numbers are displayed" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
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

        <Card title="System Defaults" subtitle="Defaults apply to new users / new setup only" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
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
          </div>
        </Card>

        <Card title="Branding" subtitle="Live preview in the sidebar, top bar, and login screen" baseShadow={cardBaseShadow} hoverShadow={cardHoverShadow} interactive>
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
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                  onChange={onFaviconSelected}
                  style={{ display: 'none' }}
                />
                <Button variant="secondary" onClick={() => void onPickFavicon()} disabled={loading || saving || !system}>
                  {pendingFaviconFile ? 'Replace favicon' : 'Upload favicon'}
                </Button>
                <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>PNG / SVG / ICO (max 2MB)</div>
              </div>
              {pendingFaviconFile ? <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.secondary }}>Pending: {pendingFaviconFile.name} (will apply on Save)</div> : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
