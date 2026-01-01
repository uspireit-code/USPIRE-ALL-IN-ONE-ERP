import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Card } from '../../components/Card';
import { getApiErrorMessage } from '../../services/api';
import {
  fetchOrganisationLogoBlob,
  getOrganisationSettings,
  updateOrganisationSettings,
  uploadOrganisationLogo,
  type OrganisationSettings,
} from '../../services/settings';

export function SettingsOrganisationPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState<OrganisationSettings | null>(null);
  const [organisationName, setOrganisationName] = useState('');
  const [organisationShortName, setOrganisationShortName] = useState('');

  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

      if (s.logoUrl) {
        const blob = await fetchOrganisationLogoBlob();
        const url = URL.createObjectURL(blob);
        setLogoPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        setLogoPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load organisation settings'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    return () => {
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!settings) return false;
    const baseName = settings.organisationName ?? '';
    const baseShort = settings.organisationShortName ?? '';
    return organisationName.trim() !== baseName || organisationShortName.trim() !== baseShort;
  }, [organisationName, organisationShortName, settings]);

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
      setSuccess('Logo uploaded successfully.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to upload logo'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 750, color: '#0B0C1E' }}>Organisation & Branding</div>
      <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>
        Manage your organisation identity and branding across the system.
      </div>

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
      </div>
    </div>
  );
}
