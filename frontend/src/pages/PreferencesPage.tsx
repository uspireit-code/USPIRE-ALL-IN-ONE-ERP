import { useEffect, useMemo, useState } from 'react';
import { Bell, Globe, Palette } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { tokens } from '../designTokens';

type Prefs = {
  theme: 'system' | 'light' | 'dark';
  timezone: string;
  dateFormat: 'DMY' | 'MDY' | 'YMD';
  compactMode: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  language: 'en' | 'fr' | 'sw';
};

const STORAGE_KEY = 'uspire.preferences.v1';

function loadPrefs(key: string): Prefs {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      ...defaultPrefs(),
      ...parsed,
    };
  } catch {
    return defaultPrefs();
  }
}

function defaultPrefs(): Prefs {
  return {
    theme: 'system',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    dateFormat: 'DMY',
    compactMode: false,
    emailNotifications: true,
    inAppNotifications: true,
    language: 'en',
  };
}

export function PreferencesPage() {
  const { state } = useAuth();
  const me = state.me;
  const userKey = String(me?.user?.id ?? me?.user?.email ?? 'anonymous').trim() || 'anonymous';
  const storageKey = `${STORAGE_KEY}:${userKey}`;

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(storageKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs(storageKey));
  }, [storageKey]);

  useEffect(() => {
    setError(null);
  }, [prefs]);

  const hasChanges = useMemo(() => {
    const current = loadPrefs(storageKey);
    return JSON.stringify(current) !== JSON.stringify(prefs);
  }, [prefs, storageKey]);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
      setToast('Preferences updated successfully');
      window.setTimeout(() => setToast(null), 2600);
    } catch {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={{ width: '100%', display: 'grid', gap: 16, minWidth: 0 }}>
        <PageHeader title="Preferences" description="Personalize your experience across the ERP." />

        <div
          style={{
            position: 'sticky',
            top: 16,
            zIndex: 2,
            background: 'rgba(252, 252, 252, 0.92)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: tokens.radius.lg,
            padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(11,12,30,0.04), 0 10px 24px rgba(11,12,30,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 850, color: tokens.colors.text.primary }}>Settings</div>
            <div style={{ marginTop: 3, fontSize: 13, color: tokens.colors.text.secondary }}>
              {hasChanges ? 'You have unsaved changes.' : 'All changes are saved.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="secondary" disabled={saving || !hasChanges} onClick={() => setPrefs(loadPrefs(storageKey))}>
              Reset
            </Button>
            <Button variant="primary" disabled={saving || !hasChanges} onClick={onSave}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </Button>
          </div>
        </div>

        {error ? <Alert tone="error" title={error} /> : null}

        <div className="cardsGrid" style={{ minWidth: 0, gap: 28, alignItems: 'stretch' }}>
          <SettingsCard
            icon={<Palette size={18} />}
            title="Appearance"
            subtitle="Theme and density."
          >
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Theme" description="Choose how the interface should look.">
                <select
                  value={prefs.theme}
                  onChange={(e) => setPrefs((p) => ({ ...p, theme: e.target.value as Prefs['theme'] }))}
                  disabled={saving}
                  style={selectStyle()}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </Field>

              <SwitchRow
                label="Compact mode"
                description="Tighter spacing for dense workflows."
                checked={prefs.compactMode}
                disabled={saving}
                onChange={(checked) => setPrefs((p) => ({ ...p, compactMode: checked }))}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Globe size={18} />}
            title="Regional"
            subtitle="Timezone and date format."
          >
            <div style={{ display: 'grid', gap: 16 }}>
              <Field label="Timezone" description="Used for dates, times, and audit logs.">
                <input
                  value={prefs.timezone}
                  onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.target.value }))}
                  disabled={saving}
                  style={inputStyle()}
                />
              </Field>

              <Field label="Date format" description="How dates are shown across the ERP.">
                <select
                  value={prefs.dateFormat}
                  onChange={(e) => setPrefs((p) => ({ ...p, dateFormat: e.target.value as Prefs['dateFormat'] }))}
                  disabled={saving}
                  style={selectStyle()}
                >
                  <option value="DMY">DD/MM/YYYY</option>
                  <option value="MDY">MM/DD/YYYY</option>
                  <option value="YMD">YYYY/MM/DD</option>
                </select>
              </Field>

              <Field label="Language" description="Primary language for menus and labels.">
                <select
                  value={prefs.language}
                  onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value as Prefs['language'] }))}
                  disabled={saving}
                  style={selectStyle()}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="sw">Swahili</option>
                </select>
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<Bell size={18} />}
            title="Notifications"
            subtitle="Choose what you receive."
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <SwitchRow
                label="In-app notifications"
                description="Show notifications in the header bell."
                checked={prefs.inAppNotifications}
                disabled={saving}
                onChange={(checked) => setPrefs((p) => ({ ...p, inAppNotifications: checked }))}
              />
              <SwitchRow
                label="Email notifications"
                description="Receive selected alerts by email."
                checked={prefs.emailNotifications}
                disabled={saving}
                onChange={(checked) => setPrefs((p) => ({ ...p, emailNotifications: checked }))}
              />
            </div>
          </SettingsCard>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

function SettingsCard(props: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <Card
      interactive
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 22,
        ...props.style,
      }}
      baseShadow={'0 1px 2px rgba(11,12,30,0.06), 0 16px 34px rgba(11,12,30,0.08)'}
      hoverShadow={'0 2px 4px rgba(11,12,30,0.08), 0 22px 50px rgba(11,12,30,0.12)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${tokens.colors.border.subtle}`,
              background: tokens.colors.surface.subtle,
              display: 'grid',
              placeItems: 'center',
              color: tokens.colors.text.secondary,
              flex: '0 0 auto',
            }}
            aria-hidden
          >
            {props.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 860, fontSize: 15, color: tokens.colors.text.primary }}>{props.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>{props.subtitle}</div>
          </div>
        </div>
      </div>

      {props.children}
    </Card>
  );
}

function Field(props: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 850, color: tokens.colors.text.secondary }}>{props.label}</div>
        {props.description ? <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>{props.description}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

function SwitchRow(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: 14,
        borderRadius: tokens.radius.sm,
        border: `1px solid ${tokens.colors.border.subtle}`,
        background: tokens.colors.surface.subtle,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 860, color: tokens.colors.text.primary }}>{props.label}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: tokens.colors.text.secondary }}>{props.description}</div>
      </div>

      <Switch checked={props.checked} disabled={props.disabled} onChange={props.onChange} />
    </div>
  );
}

function Switch(props: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const checked = props.checked;
  const disabled = Boolean(props.disabled);

  return (
    <button
      type="button"
      aria-pressed={checked ? 'true' : 'false'}
      disabled={disabled}
      onClick={() => props.onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: `1px solid ${checked ? 'rgba(11, 11, 71, 0.45)' : tokens.colors.border.default}`,
        background: checked ? 'rgba(11, 11, 71, 1)' : 'rgba(11,12,30,0.10)',
        position: 'relative',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: `background ${tokens.transition.normal}, border-color ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}`,
        boxShadow: checked ? '0 6px 16px rgba(11, 11, 71, 0.18)' : 'none',
        opacity: disabled ? 0.6 : 1,
      }}
      onFocus={(e) => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = checked
          ? '0 0 0 4px rgba(231, 158, 19, 0.18), 0 6px 16px rgba(11, 11, 71, 0.18)'
          : tokens.focusRing.ring;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = checked ? '0 6px 16px rgba(11, 11, 71, 0.18)' : 'none';
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: tokens.colors.white,
          boxShadow: '0 1px 2px rgba(11,12,30,0.22)',
          transition: `left ${tokens.transition.normal}, transform ${tokens.transition.normal}`,
          transform: checked ? 'scale(1.02)' : 'scale(1)',
        }}
      />
    </button>
  );
}

function Toast(props: { message: string | null }) {
  if (!props.message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 60,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(11, 11, 71, 0.96)',
        color: tokens.colors.white,
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 16px 34px rgba(0,0,0,0.28)',
        fontWeight: 850,
        fontSize: 13,
        letterSpacing: 0.2,
      }}
      role="status"
      aria-live="polite"
    >
      {props.message}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    height: 40,
    padding: '0 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    appearance: 'auto',
  };
}
