import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Card } from '../../components/Card';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getApiErrorMessage } from '../../services/api';
import { useBranding } from '../../branding/BrandingContext';
import {
  fetchOrganisationLogoBlob,
  getOrganisationSettings,
  updateLoginBranding,
  updateOrganisationSettings,
  uploadLoginBackground,
  uploadOrganisationLogo,
  type OrganisationSettings,
} from '../../services/settings';

export function SettingsOrganisationPage() {
  const brand = useBranding();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState<OrganisationSettings | null>(null);
  const [organisationName, setOrganisationName] = useState('');
  const [organisationShortName, setOrganisationShortName] = useState('');

  const [loginPageTitle, setLoginPageTitle] = useState('');
  const [savingLoginBranding, setSavingLoginBranding] = useState(false);
  const [uploadingLoginBackground, setUploadingLoginBackground] = useState(false);

  const [loginBackgroundPreviewUrl, setLoginBackgroundPreviewUrl] = useState<string | undefined>(undefined);
  const loginBackgroundInputRef = useRef<HTMLInputElement | null>(null);

  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const originalOrganisationNameRef = useRef('');
  const originalOrganisationShortNameRef = useRef('');
  const originalLoginPageTitleRef = useRef('');

  const NAVY = '#020445';

  const cardBaseShadow = '0 1px 2px rgba(11,12,30,0.06), 0 10px 24px rgba(11,12,30,0.08)';
  const cardHoverShadow = '0 2px 4px rgba(11,12,30,0.08), 0 16px 34px rgba(11,12,30,0.12)';

  async function refresh() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const s = await getOrganisationSettings();
      setSettings(s);
      setOrganisationName(s.organisationName ?? '');
      setOrganisationShortName(s.organisationShortName ?? '');
      setLoginPageTitle(String(s.loginPageTitle ?? 'Enterprise Resource Planning System'));

      originalOrganisationNameRef.current = String(s.organisationName ?? '');
      originalOrganisationShortNameRef.current = String(s.organisationShortName ?? '');
      originalLoginPageTitleRef.current = String(s.loginPageTitle ?? 'Enterprise Resource Planning System');

      if (s.loginPageBackgroundUrl) {
        setLoginBackgroundPreviewUrl(s.loginPageBackgroundUrl);
      } else {
        setLoginBackgroundPreviewUrl(undefined);
      }

      if (s.logoUrl) {
        const blob = await fetchOrganisationLogoBlob();
        const url = URL.createObjectURL(blob);
        setLogoPreviewUrl((prev: string | undefined) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        setLogoPreviewUrl((prev: string | undefined) => {
          if (prev) URL.revokeObjectURL(prev);
          return undefined;
        });
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load organisation settings'));
    } finally {
      setLoading(false);
    }
  }

  async function onSaveLoginBranding() {
    if (!settings) return;
    setError(null);
    setSuccess(null);
    setSavingLoginBranding(true);
    try {
      const out = await updateLoginBranding({
        loginPageTitle:
          loginPageTitle.trim() || 'Enterprise Resource Planning System',
      });
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              loginPageTitle: out.loginPageTitle,
              loginPageBackgroundUrl: out.loginPageBackgroundUrl,
            }
          : prev,
      );
      setLoginPageTitle(out.loginPageTitle);

      originalLoginPageTitleRef.current = String(out.loginPageTitle ?? 'Enterprise Resource Planning System');

      setSuccess('Login branding saved.');
    } catch (e) {
      const status = typeof (e as any)?.status === 'number' ? (e as any).status : undefined;
      if (status === 403) {
        setError('Access denied. You do not have permission to update organisation branding.');
      } else {
        setError(getApiErrorMessage(e, 'Failed to save login branding'));
      }
    } finally {
      setSavingLoginBranding(false);
    }
  }

  async function onPickLoginBackground() {
    loginBackgroundInputRef.current?.click();
  }

  async function onLoginBackgroundSelected(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    setError(null);
    setSuccess(null);
    setUploadingLoginBackground(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      setLoginBackgroundPreviewUrl((prev: string | undefined) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return blobUrl;
      });

      const out = await uploadLoginBackground(file);
      setSettings((prev) =>
        prev ? { ...prev, loginPageBackgroundUrl: out.loginPageBackgroundUrl } : prev,
      );
      if (out.loginPageBackgroundUrl)
        setLoginBackgroundPreviewUrl(out.loginPageBackgroundUrl);
      setSuccess('Login background uploaded successfully.');
    } catch (e) {
      const status = typeof (e as any)?.status === 'number' ? (e as any).status : undefined;
      if (status === 403) {
        setError('Access denied. You do not have permission to update organisation branding.');
      } else {
        setError(getApiErrorMessage(e, 'Failed to upload login background'));
      }
    } finally {
      setUploadingLoginBackground(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    return () => {
      setLogoPreviewUrl((prev: string | undefined) => {
        if (prev) URL.revokeObjectURL(prev);
        return undefined;
      });
      setLoginBackgroundPreviewUrl((prev: string | undefined) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return undefined;
      });
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!settings) return false;
    const baseName = originalOrganisationNameRef.current;
    const baseShort = originalOrganisationShortNameRef.current;
    return organisationName.trim() !== baseName.trim() || organisationShortName.trim() !== baseShort.trim();
  }, [organisationName, organisationShortName, settings]);

  const isLoginBrandingDirty = useMemo(() => {
    if (!settings) return false;
    const baseTitle = originalLoginPageTitleRef.current;
    return loginPageTitle.trim() !== String(baseTitle ?? '').trim();
  }, [loginPageTitle, settings]);

  async function onSave() {
    if (!settings) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await updateOrganisationSettings({
        organisationName: organisationName.trim(),
        organisationShortName: organisationShortName.trim() ? organisationShortName.trim() : null,
      });
      setSettings(updated);
      setOrganisationName(updated.organisationName ?? '');
      setOrganisationShortName(updated.organisationShortName ?? '');

      originalOrganisationNameRef.current = String(updated.organisationName ?? '');
      originalOrganisationShortNameRef.current = String(updated.organisationShortName ?? '');

      setSuccess('Organisation details saved.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to save organisation settings'));
    } finally {
      setSaving(false);
    }
  }

  async function onPickLogo() {
    fileInputRef.current?.click();
  }

  async function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      await uploadOrganisationLogo(file);
      await refresh();
      await brand.refresh();
      setSuccess('Organisation logo uploaded successfully.');
    } catch (e) {
      const status = typeof (e as any)?.status === 'number' ? (e as any).status : undefined;
      if (status === 403) {
        setError('Access denied. You do not have permission to update organisation branding.');
      } else {
        setError(getApiErrorMessage(e, 'Failed to upload organisation logo'));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <SettingsPageHeader
        title="Organisation & Branding"
        subtitle="Manage your organisation identity and branding across the system."
      />

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Action failed">{error}</Alert>
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success" title="Saved">{success}</Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
          style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, border: '1px solid rgba(11,12,30,0.06)' }}
        >
          <div style={{ fontSize: 14, fontWeight: 750, color: NAVY }}>Organisation Information</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Organisation Name</div>
              <input
                value={organisationName}
                onChange={(e) => {
                  setSuccess(null);
                  setOrganisationName(e.currentTarget.value);
                }}
                placeholder="Organisation name"
                disabled={loading || !settings}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(11,12,30,0.14)',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Short Name (optional)</div>
              <input
                value={organisationShortName}
                onChange={(e) => {
                  setSuccess(null);
                  setOrganisationShortName(e.currentTarget.value);
                }}
                placeholder="Short name"
                disabled={loading || !settings}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(11,12,30,0.14)',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.55)' }}>Used in headers later.</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => onSave().catch(() => undefined)}
              disabled={loading || saving || uploading || !settings || !isDirty || !organisationName.trim()}
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 10,
                border: '1px solid rgba(2,4,69,0.16)',
                background: NAVY,
                color: '#FFFFFF',
                fontWeight: 750,
                cursor: loading || saving || uploading || !settings || !isDirty || !organisationName.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || saving || uploading || !settings || !isDirty || !organisationName.trim() ? 0.55 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {isDirty && !saving ? <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.60)' }}>Unsaved changes</div> : null}
          </div>
        </Card>

        <Card
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
          style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, border: '1px solid rgba(11,12,30,0.06)' }}
        >
          <div style={{ fontSize: 14, fontWeight: 750, color: NAVY }}>Branding</div>

          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div
              style={{
                width: '100%',
                height: 140,
                borderRadius: 14,
                border: '1px dashed rgba(11,12,30,0.20)',
                background: 'rgba(2,4,69,0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Organisation logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: 'rgba(11,12,30,0.65)' }}>No logo uploaded</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>PNG, JPG, or SVG (max 5MB)</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={onLogoSelected}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => onPickLogo().catch(() => undefined)}
                disabled={loading || uploading || saving || !settings}
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(2,4,69,0.16)',
                  background: '#FFFFFF',
                  color: NAVY,
                  fontWeight: 750,
                  cursor: loading || uploading || saving || !settings ? 'not-allowed' : 'pointer',
                  opacity: loading || uploading || saving || !settings ? 0.55 : 1,
                }}
              >
                {uploading ? 'Uploading…' : logoPreviewUrl ? 'Replace logo' : 'Upload logo'}
              </button>
            </div>

            <div style={{ height: 1, background: 'rgba(11,12,30,0.06)' }} />

            <div>
              <div style={{ fontSize: 14, fontWeight: 750, color: NAVY }}>Color Settings (read-only)</div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Primary</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 6, background: settings?.primaryColor ?? NAVY, border: '1px solid rgba(11,12,30,0.10)' }} />
                    <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.75)', fontWeight: 650 }}>{settings?.primaryColor ?? '#020445'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Secondary</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 6,
                        background: settings?.secondaryColor ?? 'transparent',
                        border: '1px solid rgba(11,12,30,0.10)',
                      }}
                    />
                    <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.70)', fontWeight: 650 }}>
                      {settings?.secondaryColor ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          baseShadow={cardBaseShadow}
          hoverShadow={cardHoverShadow}
          interactive
          style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, border: '1px solid rgba(11,12,30,0.06)' }}
        >
          <div style={{ fontSize: 14, fontWeight: 750, color: NAVY }}>Login Page Branding</div>

          <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Login Page Title</div>
              <input
                value={loginPageTitle}
                onChange={(e) => {
                  setSuccess(null);
                  setLoginPageTitle(e.currentTarget.value);
                }}
                placeholder="Enterprise Resource Planning System"
                disabled={loading || !settings}
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 40,
                  borderRadius: 12,
                  border: '1px solid rgba(11,12,30,0.14)',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.62)', fontWeight: 650 }}>Login Background Image</div>
              <div
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 140,
                  borderRadius: 14,
                  border: '1px dashed rgba(11,12,30,0.20)',
                  background: 'rgba(2,4,69,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {loginBackgroundPreviewUrl ? (
                  <img src={loginBackgroundPreviewUrl} alt="Login background" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'rgba(11,12,30,0.65)' }}>No background uploaded</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>PNG or JPG (max 8MB)</div>
                  </div>
                )}
              </div>

              <input
                ref={loginBackgroundInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={onLoginBackgroundSelected}
                style={{ display: 'none' }}
              />

              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => onPickLoginBackground().catch(() => undefined)}
                  disabled={loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(2,4,69,0.16)',
                    background: '#FFFFFF',
                    color: NAVY,
                    fontWeight: 750,
                    cursor: loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings ? 'not-allowed' : 'pointer',
                    opacity: loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings ? 0.55 : 1,
                  }}
                >
                  {uploadingLoginBackground ? 'Uploading…' : loginBackgroundPreviewUrl ? 'Replace background' : 'Upload background'}
                </button>

                <button
                  onClick={() => onSaveLoginBranding().catch(() => undefined)}
                  disabled={loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings || !isLoginBrandingDirty}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(2,4,69,0.16)',
                    background: NAVY,
                    color: '#FFFFFF',
                    fontWeight: 750,
                    cursor: loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings || !isLoginBrandingDirty ? 'not-allowed' : 'pointer',
                    opacity: loading || uploading || saving || uploadingLoginBackground || savingLoginBranding || !settings || !isLoginBrandingDirty ? 0.55 : 1,
                  }}
                >
                  {savingLoginBranding ? 'Saving…' : 'Save'}
                </button>

                {isLoginBrandingDirty && !savingLoginBranding ? <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.60)' }}>Unsaved changes</div> : null}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
