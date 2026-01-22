import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canAny } from '../auth/permissions';
import { PERMISSIONS } from '../auth/permission-catalog';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { AuthBootstrapGate } from './AuthBootstrapGate';
import { globalSearch, type GlobalSearchResponse, type GlobalSearchResultItem } from '../services/search';
import { getApiErrorMessage } from '../services/api';
import { changeMyPassword, updateMyProfile, uploadMyAvatar } from '../services/users';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const brand = useBranding();
  const { effective } = brand;
  const [brandLogoOk, setBrandLogoOk] = useState(true);
  const Icon = (props: { children: React.ReactNode }) => {
    return (
      <span
        data-sidebar-icon
        style={{
          display: 'inline-flex',
          width: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 18px',
        }}
        aria-hidden="true"
      >
        {props.children}
      </span>
    );
  };

  const [profileOpen, setProfileOpen] = useState(false);

  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GlobalSearchResultItem[]>([]);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const { state, logout, hasPermission, refreshMe } = useAuth();

  const tenantName = state.me?.tenant?.name ?? '';
  const userEmail = state.me?.user?.email ?? '';
  const userRoles = Array.isArray(state.me?.user?.roles) ? state.me?.user?.roles : [];

  const avatarUrl = state.me?.user?.avatarUrl ?? null;
  const avatarSrc = useMemo(() => {
    if (!avatarUrl) return '';
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
    if (avatarUrl.startsWith('/')) {
      const base = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      return `${base}${avatarUrl}`;
    }
    return avatarUrl;
  }, [avatarUrl]);

  useEffect(() => {
    if (!searchOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (searchOpen && searchWrapRef.current && t && !searchWrapRef.current.contains(t)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  function ProfileDrawer() {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    const [fullName, setFullName] = useState(state.me?.user?.name ?? '');
    const [phone, setPhone] = useState(state.me?.user?.phone ?? '');
    const [jobTitle, setJobTitle] = useState(state.me?.user?.jobTitle ?? '');
    const [timezone, setTimezone] = useState(state.me?.user?.timezone ?? '');
    const [language, setLanguage] = useState(state.me?.user?.language ?? 'en');

    const [pwOpen, setPwOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    useEffect(() => {
      if (!profileOpen) return;
      setError('');
      setSuccess('');
      setFullName(state.me?.user?.name ?? '');
      setPhone(state.me?.user?.phone ?? '');
      setJobTitle(state.me?.user?.jobTitle ?? '');
      setTimezone(state.me?.user?.timezone ?? '');
      setLanguage(state.me?.user?.language ?? 'en');
    }, [profileOpen, state.me?.user?.avatarUrl, state.me?.user?.jobTitle, state.me?.user?.language, state.me?.user?.name, state.me?.user?.phone, state.me?.user?.timezone]);

    async function onSaveProfile() {
      setError('');
      setSuccess('');

      const nameTrimmed = fullName.trim();
      if (!nameTrimmed) {
        setError('Full name is required');
        return;
      }

      setSaving(true);
      try {
        await updateMyProfile({
          fullName: nameTrimmed,
          phone: phone.trim(),
          jobTitle: jobTitle.trim(),
          timezone: timezone.trim(),
          language: language.trim(),
        });
        await refreshMe();
        setSuccess('Profile saved');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Failed to save profile'));
      } finally {
        setSaving(false);
      }
    }

    function onCancelProfile() {
      setError('');
      setSuccess('');
      setFullName(state.me?.user?.name ?? '');
      setPhone(state.me?.user?.phone ?? '');
      setJobTitle(state.me?.user?.jobTitle ?? '');
      setTimezone(state.me?.user?.timezone ?? '');
      setLanguage(state.me?.user?.language ?? 'en');
    }

    async function onAvatarSelected(file: File | null) {
      if (!file) return;
      setError('');
      setSuccess('');
      setSaving(true);
      try {
        await uploadMyAvatar(file);
        await refreshMe();
        setSuccess('Avatar updated');
      } catch (e) {
        setError(getApiErrorMessage(e, 'Failed to upload avatar'));
      } finally {
        setSaving(false);
      }
    }

    async function onChangePassword() {
      setPwError('');
      setPwSuccess('');
      if (!currentPassword.trim()) {
        setPwError('Current password is required');
        return;
      }
      if (newPassword.length < 8) {
        setPwError('New password must be at least 8 characters');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPwError('Passwords do not match');
        return;
      }

      setPwSaving(true);
      try {
        await changeMyPassword({
          currentPassword,
          newPassword,
          confirmNewPassword,
        });
        setPwSuccess('Password updated');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } catch (e) {
        setPwError(getApiErrorMessage(e, 'Failed to change password'));
      } finally {
        setPwSaving(false);
      }
    }

    const EyeIcon = (props: { off?: boolean }) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
        {props.off ? (
          <path d="M4 20L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : null}
      </svg>
    );

    return profileOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setProfileOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            border: 0,
            background: 'rgba(0,0,0,0.55)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            bottom: 12,
            width: 540,
            maxWidth: 'calc(100vw - 24px)',
            background: '#040648',
            color: '#FFFFFF',
            borderRadius: 16,
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            overflowX: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.4 }}>My Profile</div>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              style={{
                border: 0,
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
                width: 34,
                height: 34,
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: 20, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 999,
                  border: '2px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.10)',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{state.me?.user?.name ?? userEmail}</div>
                <div style={{ marginTop: 3, fontSize: 12, opacity: 0.85 }}>{state.me?.user?.email ?? ''}</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.08)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Upload avatar
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={saving}
                      style={{ display: 'none' }}
                      onChange={(e) => onAvatarSelected(e.currentTarget.files?.[0] ?? null)}
                    />
                  </label>

                  <div style={{ fontSize: 12, opacity: 0.75, alignSelf: 'center' }}>PNG/JPG/WEBP up to 2MB</div>
                </div>
              </div>
            </div>

            {error ? (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'rgba(255,74,74,0.12)', border: '1px solid rgba(255,74,74,0.22)', fontSize: 12 }}>
                {error}
              </div>
            ) : null}
            {success ? (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'rgba(55,255,170,0.12)', border: '1px solid rgba(55,255,170,0.20)', fontSize: 12 }}>
                {success}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.78, fontWeight: 800, marginBottom: 6 }}>Full name</div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.78, fontWeight: 800, marginBottom: 6 }}>Phone</div>
                  <input
                    value={phone ?? ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', outline: 'none' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.78, fontWeight: 800, marginBottom: 6 }}>Job title</div>
                  <input
                    value={jobTitle ?? ''}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Job title"
                    style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.78, fontWeight: 800, marginBottom: 6 }}>Timezone</div>
                  <select
                    value={timezone ?? ''}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', outline: 'none' }}
                  >
                    <option value="">(none)</option>
                    <option value="UTC">UTC</option>
                    <option value="Africa/Johannesburg">Africa/Johannesburg</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.78, fontWeight: 800, marginBottom: 6 }}>Language</div>
                  <select
                    value={language ?? 'en'}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 12px', outline: 'none' }}
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={onSaveProfile}
                  disabled={saving}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 12,
                    border: 0,
                    background: '#FFFFFF',
                    color: '#040648',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 900,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={onCancelProfile}
                  disabled={saving}
                  style={{
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'transparent',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 850,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.10)' }} />

            <div style={{ display: 'grid', gap: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setPwOpen((v) => !v);
                  setPwError('');
                  setPwSuccess('');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  color: '#fff',
                  fontWeight: 900,
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                Change password
                <span style={{ opacity: 0.85 }}>{pwOpen ? '▲' : '▼'}</span>
              </button>

              {pwOpen ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  {pwError ? (
                    <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,74,74,0.12)', border: '1px solid rgba(255,74,74,0.22)', fontSize: 12 }}>
                      {pwError}
                    </div>
                  ) : null}
                  {pwSuccess ? (
                    <div style={{ padding: 10, borderRadius: 12, background: 'rgba(55,255,170,0.12)', border: '1px solid rgba(55,255,170,0.20)', fontSize: 12 }}>
                      {pwSuccess}
                    </div>
                  ) : null}

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 42px 0 12px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                      style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 4 }}
                    >
                      <EyeIcon off={showCurrentPassword} />
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 42px 0 12px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 4 }}
                    >
                      <EyeIcon off={showNewPassword} />
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={{ width: '100%', height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '0 42px 0 12px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 4 }}
                    >
                      <EyeIcon off={showConfirmPassword} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onChangePassword}
                    disabled={pwSaving}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 12,
                      border: 0,
                      background: 'rgba(255,255,255,0.92)',
                      color: '#040648',
                      cursor: pwSaving ? 'not-allowed' : 'pointer',
                      fontWeight: 900,
                      justifySelf: 'start',
                    }}
                  >
                    {pwSaving ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.10)' }} />

            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                <div style={{ marginTop: 4 }}>Tenant: {tenantName || ''}</div>
                <div style={{ marginTop: 4 }}>{userRoles.length ? `Roles: ${userRoles.join(', ')}` : ''}</div>
              </div>
            </div>
            </div>
          </div>

          <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                logout();
              }}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 14,
                border: '1px solid rgba(255,74,74,0.75)',
                background: 'transparent',
                color: '#FF4A4A',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    ) : null;
  }

  async function runSearch(term: string) {
    const q = term.trim();
    setSearchError(null);
    setSearchLoading(true);
    try {
      const resp: GlobalSearchResponse = await globalSearch(q);
      setSearchResults(Array.isArray(resp.results) ? resp.results : []);
      setSearchOpen(true);
    } catch (e: any) {
      setSearchError('Search failed');
      setSearchResults([]);
      setSearchOpen(true);
    } finally {
      setSearchLoading(false);
    }
  }

  function groupResults(items: GlobalSearchResultItem[]) {
    const groups: Record<string, GlobalSearchResultItem[]> = {};
    for (const r of items) {
      const k = String(r.type);
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    }
    return groups;
  }

  type NavLevel = 1 | 2 | 3;

  const SidebarToggle = (props: {
    label: string;
    icon: React.ReactNode;
    open: boolean;
    active: boolean;
    level: NavLevel;
    onToggle: () => void;
  }) => {
    return (
      <button
        type="button"
        style={actionStyle({ isActive: props.active, isOpen: props.open, level: props.level })}
        onClick={props.onToggle}
        onMouseEnter={(e) => {
          if (props.active) return;
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.06)';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.92';
        }}
        onMouseLeave={(e) => {
          if (props.active) return;
          (e.currentTarget as HTMLButtonElement).style.background = props.open ? 'rgba(255, 255, 255, 0.06)' : 'transparent';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.72';
        }}
      >
        <span data-sidebar-icon style={{ display: 'inline-flex', opacity: props.active ? 1 : 0.72 }} aria-hidden="true">
          <Icon>{props.icon}</Icon>
        </span>
        <span
          style={{
            color: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          {props.label}
        </span>
        <Chevron open={props.open} />
      </button>
    );
  };

  type L1Key = 'finance' | 'settings' | null;
  const [openL1, setOpenL1] = useState<L1Key | null>(null);

  const [openFinanceL2, setOpenFinanceL2] = useState<{ gl: boolean; ar: boolean; ap: boolean; cash: boolean; imprest: boolean; budgets: boolean; reports: boolean }>({
    gl: false,
    ar: false,
    ap: false,
    cash: false,
    imprest: false,
    budgets: false,
    reports: false,
  });

  const path = location.pathname;

  const isFinanceActive = useMemo(() => {
    return (
      path.startsWith('/finance') ||
      path.startsWith('/periods') ||
      path.startsWith('/reports') ||
      path.startsWith('/audit')
    );
  }, [path]);

  const isSettingsActive = useMemo(() => {
    return path.startsWith('/settings');
  }, [path]);

  const financeActiveL2 = useMemo(() => {
    return {
      gl: path.startsWith('/finance/gl'),
      ar: path.startsWith('/finance/ar'),
      ap: path.startsWith('/finance/ap'),
      cash: path.startsWith('/finance/cash') || path.startsWith('/finance/cash-bank') || path.startsWith('/bank-reconciliation'),
      imprest: path.startsWith('/finance/imprest'),
      budgets: path.startsWith('/finance/budgets'),
      reports: path.startsWith('/reports'),
    };
  }, [path]);

  const Indent = (props: { level: 2 | 3; children: React.ReactNode }) => {
    const pad = props.level === 2 ? 12 : 28;
    return <div style={{ paddingLeft: pad }}>{props.children}</div>;
  };

  const Chevron = (props: { open: boolean }) => {
    return (
      <span
        aria-hidden="true"
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          transition: 'transform 160ms ease',
          transform: props.open ? 'rotate(90deg)' : 'rotate(0deg)',
          opacity: 0.9,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    );
  };

  const FolderIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );

  const FileTextIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );

  const UploadIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5-5 5 5" />
      <path d="M12 5v14" />
    </svg>
  );

  const RepeatIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );

  const ClipboardIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );

  const UsersIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  const ReceiptIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2H4Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h6" />
    </svg>
  );

  const BanknoteIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  );

  const pageTitleByPath: Array<{ match: (path: string) => boolean; title: string }> = [
    { match: (p) => p === '/', title: 'Dashboard' },
    { match: (p) => p === '/dashboard', title: 'Management Dashboard' },
    { match: (p) => p.startsWith('/finance'), title: 'Finance & Accounting' },
    { match: (p) => p.startsWith('/ap'), title: 'Accounts Payable' },
    { match: (p) => p.startsWith('/ar'), title: 'Accounts Receivable' },
    { match: (p) => p.startsWith('/payments'), title: 'Payments' },
    { match: (p) => p.startsWith('/reports'), title: 'Reports' },
    { match: (p) => p.startsWith('/forecasts'), title: 'Forecasts' },
    { match: (p) => p.startsWith('/bank-reconciliation'), title: 'Bank Reconciliation' },
    { match: (p) => p.startsWith('/opening-balances'), title: 'GL / Opening Balances' },
    { match: (p) => p.startsWith('/fixed-assets'), title: 'Fixed Assets' },
    { match: (p) => p.startsWith('/periods'), title: 'Periods' },
    { match: (p) => p.startsWith('/audit'), title: 'Audit' },
    { match: (p) => p.startsWith('/settings'), title: 'Settings' },
  ];

  const pageTitle = pageTitleByPath.find((x) => x.match(location.pathname))?.title ?? (effective?.organisationShortName || effective?.organisationName || 'USPIRE ERP');
  const showTopBar = !location.pathname.startsWith('/login');

  const headerEnvRaw = String((import.meta as any)?.env?.VITE_APP_ENV ?? '').trim();
  const headerEnv = headerEnvRaw ? headerEnvRaw.toUpperCase() : 'DEV';

  function getBreadcrumbForPath(p: string) {
    const segs = (p ?? '').split('?')[0].split('/').filter(Boolean);
    if (segs.length === 0) return { module: 'Dashboard', sub: '' };

    if (p.startsWith('/finance/gl')) {
      const sub = p.startsWith('/finance/gl/journals') ? 'Journals' : p.startsWith('/finance/gl/upload') ? 'Journal Upload' : 'General Ledger';
      return { module: 'Finance & Accounting', sub };
    }
    if (p.startsWith('/finance/ap')) return { module: 'Finance & Accounting', sub: 'Accounts Payable' };
    if (p.startsWith('/finance/ar')) return { module: 'Finance & Accounting', sub: 'Accounts Receivable' };
    if (p.startsWith('/finance/imprest')) return { module: 'Finance & Accounting', sub: 'Imprest' };
    if (p.startsWith('/finance/cash') || p.startsWith('/finance/cash-bank') || p.startsWith('/bank-reconciliation')) {
      return { module: 'Cash & Bank', sub: 'Bank Reconciliation' };
    }
    if (p.startsWith('/reports')) return { module: 'Reports', sub: '' };
    if (p.startsWith('/periods')) return { module: 'Finance & Accounting', sub: 'Periods' };
    if (p.startsWith('/audit')) return { module: 'Audit', sub: '' };
    if (p.startsWith('/settings')) return { module: 'Settings', sub: '' };

    return { module: pageTitle, sub: '' };
  }

  const breadcrumb = useMemo(() => getBreadcrumbForPath(location.pathname), [location.pathname, pageTitle]);
  const breadcrumbDisplay = breadcrumb.sub ? `${breadcrumb.module} \u203a ${breadcrumb.sub}` : breadcrumb.module;

  const envBadge = useMemo(() => {
    const env = headerEnv;
    const isDev = env === 'DEV' || env === 'LOCAL';
    const isStaging = env === 'STAGING' || env === 'UAT';
    const bg = isDev ? 'rgba(56, 189, 248, 0.20)' : isStaging ? 'rgba(249, 115, 22, 0.22)' : 'rgba(34, 197, 94, 0.22)';
    const border = isDev ? 'rgba(56, 189, 248, 0.35)' : isStaging ? 'rgba(249, 115, 22, 0.36)' : 'rgba(34, 197, 94, 0.36)';
    const color = isDev ? '#BAE6FD' : isStaging ? '#FED7AA' : '#BBF7D0';
    return { env, bg, border, color };
  }, [headerEnv]);

  const GridIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );

  const BookIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );

  const CalculatorIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h8" />
    </svg>
  );

  const BarChartIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16v-6" />
      <path d="M11 16v-10" />
      <path d="M15 16v-4" />
      <path d="M19 16v-8" />
    </svg>
  );

  const BellIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );

  const COLORS = {
    navy: '#020445',
    gold: '#EDBA35',
    white: '#FCFCFC',
  };

  const TOPBAR_HEIGHT = 60;

  const SIDEBAR_WIDTH = 280;

  const hasSystemViewAll = hasPermission(PERMISSIONS.SYSTEM.VIEW_ALL);
  const hasFinanceViewAll = hasPermission(PERMISSIONS.FINANCE.VIEW_ALL);
  const hasSystemConfigView = hasPermission(PERMISSIONS.SYSTEM.CONFIG_VIEW);
  const hasSystemSettingsView = hasPermission(PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW);
  const hasFinanceConfigView = hasPermission(PERMISSIONS.FINANCE.CONFIG_VIEW);
  const hasUserView = hasPermission(PERMISSIONS.USER.VIEW);
  const hasRoleView = hasPermission(PERMISSIONS.ROLE.VIEW);

  const showAudit = hasPermission(PERMISSIONS.AUDIT_VIEW) || hasSystemViewAll;

  const showArAging =
    hasPermission(PERMISSIONS.AR_AGING.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showArStatements =
    hasPermission(PERMISSIONS.AR_STATEMENT.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showSupplierStatements =
    hasPermission(PERMISSIONS.REPORT.SUPPLIER_STATEMENT_VIEW) ||
    hasFinanceViewAll ||
    hasSystemViewAll;
  const showApAging =
    hasPermission(PERMISSIONS.REPORT.AP_AGING_VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showPaymentProposals =
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW) ||
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE) ||
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_APPROVE) ||
    hasFinanceViewAll;
  const showPaymentRuns =
    hasPermission(PERMISSIONS.AP.PAYMENT_RUN_VIEW) || hasFinanceViewAll;
  const showArReminders =
    hasPermission(PERMISSIONS.AR_REMINDER.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showGlCreate = hasPermission(PERMISSIONS.GL.CREATE);
  const showGlView = hasPermission(PERMISSIONS.GL.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showGlReviewQueue = hasPermission(PERMISSIONS.GL.APPROVE);
  const showGlPostQueue = hasPermission(PERMISSIONS.GL.FINAL_POST);
  const showGlRecurring =
    hasPermission(PERMISSIONS.GL.RECURRING_MANAGE) ||
    hasPermission(PERMISSIONS.GL.RECURRING_GENERATE);
  const showGlRiskIntelligence = showGlView;
  const showGlRegister = showGlView;
  const showGlDrafts = showGlCreate;
  const showCoa = hasPermission(PERMISSIONS.COA.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showPeriods =
    hasFinanceViewAll ||
    hasSystemViewAll ||
    hasPermission(PERMISSIONS.PERIOD.VIEW) ||
    hasPermission(PERMISSIONS.PERIOD.CLOSE_APPROVE) ||
    hasPermission(PERMISSIONS.PERIOD.REOPEN);

  const showBudgetSetup =
    hasPermission(PERMISSIONS.BUDGET.VIEW) ||
    hasPermission(PERMISSIONS.BUDGET.CREATE) ||
    hasPermission(PERMISSIONS.BUDGET.APPROVE);

  const showBudgetVsActual = hasPermission(PERMISSIONS.BUDGET.FINANCE_VIEW);

  const showFinanceBudgets = showBudgetSetup || showBudgetVsActual;
  const showForecasts = hasPermission(PERMISSIONS.FORECAST.VIEW);

  const showArCustomers =
    hasPermission(PERMISSIONS.CUSTOMERS.VIEW) || hasFinanceViewAll || hasSystemViewAll;
  const showArInvoices =
    hasPermission(PERMISSIONS.AR.INVOICE_VIEW) ||
    hasPermission(PERMISSIONS.AR.INVOICE_CREATE) ||
    hasFinanceViewAll ||
    hasSystemViewAll;
  const showArReceipts =
    hasPermission(PERMISSIONS.AR.RECEIPT_VIEW) ||
    hasPermission(PERMISSIONS.AR.RECEIPT_POST) ||
    hasPermission(PERMISSIONS.AR.RECEIPT_CREATE) ||
    hasFinanceViewAll ||
    hasSystemViewAll;
  const showArCreditNotes =
    canAny(state.me, [
      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
      PERMISSIONS.AR.CREDIT_NOTE_POST,
    ]) ||
    hasFinanceViewAll ||
    hasSystemViewAll;
  const showArRefunds =
    canAny(state.me, [
      PERMISSIONS.AR.REFUND_VIEW,
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_POST,
    ]) ||
    hasFinanceViewAll ||
    hasSystemViewAll;

  const showFixedAssets =
    hasPermission(PERMISSIONS.FA.CATEGORY_MANAGE) ||
    hasPermission(PERMISSIONS.FA.ASSET_CREATE) ||
    hasPermission(PERMISSIONS.FA.ASSET_CAPITALIZE) ||
    hasPermission(PERMISSIONS.FA.DEPRECIATION_RUN) ||
    hasPermission(PERMISSIONS.FA.DISPOSE);

  const showBankReconciliation = hasPermission(PERMISSIONS.BANK.RECONCILIATION_VIEW);

  const showApBills =
    hasPermission(PERMISSIONS.AP.INVOICE_VIEW) ||
    hasPermission(PERMISSIONS.AP.INVOICE_CREATE) ||
    hasFinanceViewAll ||
    hasSystemViewAll;

  const showImprest =
    hasFinanceViewAll ||
    hasSystemViewAll ||
    canAny(state.me, [
      PERMISSIONS.IMPREST.TYPE_POLICY_VIEW,
      PERMISSIONS.IMPREST.TYPE_POLICY_CREATE,
      PERMISSIONS.IMPREST.TYPE_POLICY_EDIT,
      PERMISSIONS.IMPREST.TYPE_POLICY_DEACTIVATE,
      PERMISSIONS.IMPREST.FACILITY_VIEW,
      PERMISSIONS.IMPREST.FACILITY_CREATE,
      PERMISSIONS.IMPREST.FACILITY_EDIT,
      PERMISSIONS.IMPREST.FACILITY_SUSPEND,
      PERMISSIONS.IMPREST.FACILITY_CLOSE,
      PERMISSIONS.IMPREST.CASE_VIEW,
      PERMISSIONS.IMPREST.CASE_CREATE,
      PERMISSIONS.IMPREST.CASE_REVIEW,
      PERMISSIONS.IMPREST.CASE_APPROVE,
      PERMISSIONS.IMPREST.CASE_ISSUE,
    ]);

  const showSettings =
    hasSystemViewAll ||
    hasSystemConfigView ||
    hasSystemSettingsView ||
    hasFinanceConfigView ||
    hasUserView ||
    hasRoleView;

  const showSystemConfigurationSettings =
    hasSystemViewAll || hasSystemConfigView || hasSystemSettingsView || hasFinanceConfigView;

  const showFinanceNav =
    hasFinanceViewAll ||
    hasSystemViewAll ||
    showCoa ||
    showGlView ||
    showPeriods ||
    showFinanceBudgets ||
    showForecasts ||
    showFixedAssets ||
    showBankReconciliation ||
    showApBills ||
    showArCustomers ||
    showArInvoices ||
    showArReceipts ||
    showArCreditNotes ||
    showArRefunds ||
    showImprest;

  const linkBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 10,
    textDecoration: 'none',
    color: COLORS.white,
    fontSize: 14,
    lineHeight: '20px',
    cursor: 'pointer',
    transition: 'background 200ms ease, color 200ms ease',
  };

  const metricsByLevel: Record<NavLevel, { fontSize: number; fontWeight: number; paddingY: number; radius: number; lineHeight: string }> = {
    1: { fontSize: 14, fontWeight: 600, paddingY: 11, radius: 10, lineHeight: '20px' },
    2: { fontSize: 13, fontWeight: 500, paddingY: 9, radius: 9, lineHeight: '18px' },
    3: { fontSize: 12, fontWeight: 400, paddingY: 7, radius: 8, lineHeight: '16px' },
  };

  const actionStyle = ({ isActive, isOpen, level }: { isActive: boolean; isOpen: boolean; level: NavLevel }): React.CSSProperties => {
    const m = metricsByLevel[level];
    return {
      ...linkBaseStyle,
      width: '100%',
      border: 0,
      background: isActive ? 'rgba(237, 186, 53, 0.10)' : isOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
      borderLeft: isActive ? `3px solid ${COLORS.gold}` : '3px solid transparent',
      paddingLeft: isActive ? 11 : 14,
      fontWeight: m.fontWeight,
      color: COLORS.white,
      textAlign: 'left',
      fontSize: m.fontSize,
      lineHeight: m.lineHeight,
      paddingTop: m.paddingY,
      paddingBottom: m.paddingY,
      borderRadius: m.radius,
    };
  };

  const linkStyle = ({ isActive, level }: { isActive: boolean; level: NavLevel }): React.CSSProperties => {
    const m = metricsByLevel[level];
    return {
      ...linkBaseStyle,
      background: isActive ? 'rgba(237, 186, 53, 0.10)' : 'transparent',
      borderLeft: isActive ? `3px solid ${COLORS.gold}` : '3px solid transparent',
      paddingLeft: isActive ? 11 : 14,
      fontWeight: level === 3 ? (isActive ? 500 : m.fontWeight) : m.fontWeight,
      color: COLORS.white,
      fontSize: m.fontSize,
      lineHeight: m.lineHeight,
      paddingTop: m.paddingY,
      paddingBottom: m.paddingY,
      borderRadius: m.radius,
    };
  };

  const linkHoverStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.06)',
  };

  const Section = (props: { title?: string; children: React.ReactNode }) => {
    const title = String(props.title ?? '').trim();
    return (
      <div style={{ marginTop: title ? 18 : 0 }}>
        {title ? (
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.70)',
              padding: '0 14px',
            }}
          >
            {title}
          </div>
        ) : null}
        <div style={{ marginTop: title ? 10 : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{props.children}</div>
      </div>
    );
  };

  const SidebarLink = (props: {
    to: string;
    label: string;
    icon: React.ReactNode;
    end?: boolean;
    level: NavLevel;
    activeMatch?: (location: { pathname: string; search: string }) => boolean;
  }) => {
    return (
      <NavLink
        to={props.to}
        end={props.end}
        style={({ isActive }) => {
          const derivedActive = props.activeMatch ? props.activeMatch({ pathname: location.pathname, search: location.search }) : isActive;
          return linkStyle({ isActive: derivedActive, level: props.level });
        }}
        onMouseEnter={(e) => {
          if ((e.currentTarget as any)?.getAttribute('aria-current') === 'page') return;
          Object.assign(e.currentTarget.style, linkHoverStyle);
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.92';
        }}
        onMouseLeave={(e) => {
          if ((e.currentTarget as any)?.getAttribute('aria-current') === 'page') return;
          e.currentTarget.style.background = 'transparent';
          const iconEl = e.currentTarget.querySelector('[data-sidebar-icon]') as HTMLElement | null;
          if (iconEl) iconEl.style.opacity = '0.72';
        }}
      >
        {({ isActive }) => {
          const derivedActive = props.activeMatch ? props.activeMatch({ pathname: location.pathname, search: location.search }) : isActive;
          return (
            <>
              <span data-sidebar-icon style={{ display: 'inline-flex', opacity: derivedActive ? 1 : 0.72 }} aria-hidden="true">
                <Icon>{props.icon}</Icon>
              </span>
              <span
                style={{
                  color: 'inherit',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flex: '1 1 auto',
                }}
              >
                {props.label}
              </span>
            </>
          );
        }}
      </NavLink>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.white }}>
      <div
        style={{
          width: SIDEBAR_WIDTH,
          padding: 16,
          background: COLORS.navy,
          color: COLORS.white,
          boxSizing: 'border-box',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.08)',
          position: 'fixed',
          top: 0,
          left: 0,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px' }}>
            {effective?.logoUrl && brandLogoOk ? (
              <img
                src={resolveBrandAssetUrl(effective.logoUrl) ?? ''}
                alt="Organisation logo"
                style={{ height: 22, width: 'auto', maxWidth: 120, objectFit: 'contain' }}
                onError={() => setBrandLogoOk(false)}
              />
            ) : null}
            <div style={{ fontWeight: 800, letterSpacing: 0.3, fontSize: 15 }}>
              {effective?.organisationShortName || effective?.organisationName || 'USPIRE ERP'}
            </div>
          </div>
          <div style={{ marginTop: 8, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <nav style={{ marginTop: 14, flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          <Section>
            <SidebarLink to="/" label="Dashboard" icon={<GridIcon />} end level={1} />

            {showFinanceNav ? (
              <>
                <SidebarToggle
                  label="Finance & Accounting"
                  icon={<CalculatorIcon />}
                  open={openL1 === 'finance'}
                  active={isFinanceActive}
                  level={1}
                  onToggle={() => setOpenL1((v) => (v === 'finance' ? null : 'finance'))}
                />
                {openL1 === 'finance' ? (
                  <Indent level={2}>
                    {showCoa ? <SidebarLink to="/finance/coa" label="Chart of Accounts" icon={<BookIcon />} level={2} /> : null}

                    <SidebarToggle
                      label="General Ledger"
                      icon={<FolderIcon />}
                      open={openFinanceL2.gl}
                      active={financeActiveL2.gl}
                      level={2}
                      onToggle={() => setOpenFinanceL2((s) => ({ ...s, gl: !s.gl }))}
                    />
                    {openFinanceL2.gl ? (
                      <Indent level={3}>
                        {showGlCreate ? <SidebarLink to="/finance/gl/journals/new" end label="New Journal" icon={<FileTextIcon />} level={3} /> : null}
                        {showGlCreate ? <SidebarLink to="/finance/gl/upload" end label="Journal Upload" icon={<UploadIcon />} level={3} /> : null}
                        {showGlDrafts ? (
                          <SidebarLink
                            to="/finance/gl/journals?workbench=1"
                            end
                            label="Draft Journals"
                            icon={<FileTextIcon />}
                            level={3}
                            activeMatch={(loc) => {
                              if (loc.pathname !== '/finance/gl/journals') return false;
                              const qs = new URLSearchParams(loc.search);
                              return qs.get('workbench') === '1';
                            }}
                          />
                        ) : null}
                        {showGlReviewQueue ? <SidebarLink to="/finance/gl/review" end label="Review Queue" icon={<ClipboardIcon />} level={3} /> : null}
                        {showGlPostQueue ? <SidebarLink to="/finance/gl/post" end label="Post Queue" icon={<ClipboardIcon />} level={3} /> : null}
                        {showGlRegister ? (
                          <SidebarLink
                            to="/finance/gl/journals"
                            end
                            label="Journal Register"
                            icon={<FileTextIcon />}
                            level={3}
                            activeMatch={(loc) => {
                              if (loc.pathname !== '/finance/gl/journals') return false;
                              const qs = new URLSearchParams(loc.search);
                              return qs.get('workbench') !== '1' && qs.get('drilldown') !== '1';
                            }}
                          />
                        ) : null}
                        {showGlRiskIntelligence ? <SidebarLink to="/finance/gl/risk" end label="Risk Intelligence" icon={<ShieldIcon />} level={3} /> : null}
                        {showGlRecurring ? <SidebarLink to="/finance/gl/recurring" end label="Recurring Journals" icon={<RepeatIcon />} level={3} /> : null}
                      </Indent>
                    ) : null}

                <SidebarToggle
                  label="Accounts Receivable"
                  icon={<FolderIcon />}
                  open={openFinanceL2.ar}
                  active={financeActiveL2.ar}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, ar: !s.ar }))}
                />
                {openFinanceL2.ar ? (
                  <Indent level={3}>
                    {showArCustomers ? (
                      <SidebarLink to="/finance/ar/customers" label="Customers" icon={<UsersIcon />} level={3} />
                    ) : null}
                    {showArInvoices ? (
                      <SidebarLink to="/finance/ar/invoices" label="Invoices" icon={<ReceiptIcon />} level={3} />
                    ) : null}
                    {showArReceipts ? (
                      <SidebarLink to="/finance/ar/receipts" label="Receipts" icon={<ReceiptIcon />} level={3} />
                    ) : null}
                    {showArCreditNotes ? <SidebarLink to="/finance/ar/credit-notes" label="Credit Notes" icon={<FileTextIcon />} level={3} /> : null}
                    {showArRefunds ? <SidebarLink to="/finance/ar/refunds" label="Refunds" icon={<BanknoteIcon />} level={3} /> : null}
                    {showArAging ? <SidebarLink to="/ar/aging" label="AR Aging" icon={<BarChartIcon />} level={3} /> : null}
                    {showArStatements ? <SidebarLink to="/ar/statements" label="Statements" icon={<FileTextIcon />} level={3} /> : null}
                    {showArReminders ? <SidebarLink to="/ar/reminders" label="Reminders" icon={<BellIcon />} level={3} /> : null}
                  </Indent>
                ) : null}

                <SidebarToggle
                  label="Accounts Payable"
                  icon={<FolderIcon />}
                  open={openFinanceL2.ap}
                  active={financeActiveL2.ap}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, ap: !s.ap }))}
                />
                {openFinanceL2.ap ? (
                  <Indent level={3}>
                    <SidebarLink to="/finance/ap/suppliers" label="Suppliers" icon={<UsersIcon />} level={3} />
                    {showApBills ? (
                      <SidebarLink to="/finance/ap/bills" label="Bills / Invoices" icon={<ReceiptIcon />} level={3} />
                    ) : null}
                    {showSupplierStatements ? (
                      <SidebarLink
                        to="/finance/ap/supplier-statements"
                        label="Supplier Statements"
                        icon={<FileTextIcon />}
                        level={3}
                      />
                    ) : null}
                    {showApAging ? (
                      <SidebarLink to="/finance/ap/aging" label="AP Aging" icon={<BarChartIcon />} level={3} />
                    ) : null}
                    {showPaymentProposals ? (
                      <SidebarLink
                        to="/finance/ap/payment-proposals"
                        label="Payment Proposals"
                        icon={<ClipboardIcon />}
                        level={3}
                      />
                    ) : null}
                    {showPaymentRuns ? (
                      <SidebarLink
                        to="/finance/ap/payment-runs"
                        label="Payment Runs"
                        icon={<ClipboardIcon />}
                        level={3}
                      />
                    ) : null}
                  </Indent>
                ) : null}

                <SidebarToggle
                  label="Cash & Bank"
                  icon={<FolderIcon />}
                  open={openFinanceL2.cash}
                  active={financeActiveL2.cash}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, cash: !s.cash }))}
                />
                {openFinanceL2.cash ? (
                  <Indent level={3}>
                    <SidebarLink to="/finance/cash-bank/bank-accounts" label="Bank Accounts" icon={<BanknoteIcon />} level={3} />
                    <SidebarLink to="/finance/cash/reconciliation" label="Bank Reconciliation" icon={<CalculatorIcon />} level={3} />
                    {showBankReconciliation ? <SidebarLink to="/bank-reconciliation" label="Bank Reconciliation" icon={<CalculatorIcon />} level={3} /> : null}
                  </Indent>
                ) : null}

                {showImprest ? (
                  <>
                    <SidebarToggle
                      label="Imprest"
                      icon={<FolderIcon />}
                      open={openFinanceL2.imprest}
                      active={financeActiveL2.imprest}
                      level={2}
                      onToggle={() => setOpenFinanceL2((s) => ({ ...s, imprest: !s.imprest }))}
                    />
                    {openFinanceL2.imprest ? (
                      <Indent level={3}>
                        <SidebarLink
                          to="/finance/imprest/policies"
                          label="Imprest Types"
                          icon={<FileTextIcon />}
                          level={3}
                        />
                        <SidebarLink
                          to="/finance/imprest/facilities"
                          label="Imprest Facilities"
                          icon={<FileTextIcon />}
                          level={3}
                        />
                        <SidebarLink
                          to="/finance/imprest/cases"
                          label="Imprest Cases"
                          icon={<FileTextIcon />}
                          level={3}
                        />
                      </Indent>
                    ) : null}
                  </>
                ) : null}

                {showPeriods ? <SidebarLink to="/periods" label="Periods" icon={<FolderIcon />} level={2} /> : null}

                {showFinanceBudgets ? (
                  <>
                    <SidebarToggle
                      label="Budgets"
                      icon={<ClipboardIcon />}
                      open={openFinanceL2.budgets}
                      active={financeActiveL2.budgets}
                      level={2}
                      onToggle={() => setOpenFinanceL2((s) => ({ ...s, budgets: !s.budgets }))}
                    />
                    {openFinanceL2.budgets ? (
                      <Indent level={3}>
                        {showBudgetSetup ? (
                          <SidebarLink
                            to="/finance/budgets"
                            label="Budget Setup"
                            icon={<ClipboardIcon />}
                            level={3}
                            activeMatch={(loc) => {
                              return loc.pathname.startsWith('/finance/budgets') && !loc.pathname.startsWith('/finance/budgets/vs-actual');
                            }}
                          />
                        ) : null}

                        {showBudgetVsActual ? (
                          <SidebarLink
                            to="/finance/budgets/vs-actual"
                            label="Budget vs Actual"
                            icon={<BarChartIcon />}
                            level={3}
                            activeMatch={(loc) => loc.pathname.startsWith('/finance/budgets/vs-actual')}
                          />
                        ) : null}
                      </Indent>
                    ) : null}
                  </>
                ) : null}

                {showForecasts ? <SidebarLink to="/forecasts" label="Forecasts" icon={<BarChartIcon />} level={2} /> : null}

                {showFixedAssets ? <SidebarLink to="/fixed-assets" label="Fixed Assets" icon={<FolderIcon />} level={2} /> : null}

                <SidebarToggle
                  label="Reports"
                  icon={<FolderIcon />}
                  open={openFinanceL2.reports}
                  active={financeActiveL2.reports}
                  level={2}
                  onToggle={() => setOpenFinanceL2((s) => ({ ...s, reports: !s.reports }))}
                />
                {openFinanceL2.reports ? (
                  <Indent level={3}>
                    <SidebarLink to="/reports/trial-balance" label="Trial Balance" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/profit-and-loss" label="P&L" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/balance-sheet" label="Balance Sheet" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/cash-flow" label="Cash Flow" icon={<BarChartIcon />} level={3} />
                    <SidebarLink to="/reports/soce" label="SOCE" icon={<BarChartIcon />} level={3} />
                  </Indent>
                ) : null}

                <SidebarLink to="/reports/disclosure-notes" label="Disclosure Notes" icon={<FileTextIcon />} level={2} />
                {showAudit ? <SidebarLink to="/audit" label="Audit" icon={<ShieldIcon />} level={2} /> : null}
              </Indent>
            ) : null}
              </>
            ) : null}

            <SidebarToggle
              label="Settings"
              icon={<SettingsIcon />}
              open={openL1 === 'settings'}
              active={isSettingsActive}
              level={1}
              onToggle={() => setOpenL1((v) => (v === 'settings' ? null : 'settings'))}
            />
            {openL1 === 'settings' ? (
              <Indent level={2}>
                {showSettings ? (
                  <>
                    <SidebarLink to="/settings" label="Settings" icon={<SettingsIcon />} level={2} />
                    {showSystemConfigurationSettings ? (
                      <SidebarLink to="/settings/system" label="System Configuration" icon={<SettingsIcon />} level={2} />
                    ) : null}
                    <SidebarLink to="/settings/users" label="Users" icon={<UsersIcon />} level={2} />
                    <SidebarLink to="/settings/roles" label="Roles" icon={<ClipboardIcon />} level={2} />
                  </>
                ) : null}
              </Indent>
            ) : null}
          </Section>
        </nav>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', padding: '0 8px' }}>
            Logged in as: {state.me?.user?.email ?? '—'}
          </div>
          <button
            onClick={logout}
            style={{
              marginTop: 10,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'transparent',
              color: COLORS.white,
              cursor: 'pointer',
              transition: 'background 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.24)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {showTopBar ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: SIDEBAR_WIDTH,
            right: 0,
            height: TOPBAR_HEIGHT,
            background: COLORS.navy,
            color: COLORS.white,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            boxShadow: '0 8px 18px rgba(2,4,69,0.18)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 14, letterSpacing: 0.2, whiteSpace: 'nowrap', opacity: 0.98 }}>
            {breadcrumbDisplay}
          </div>

          <div ref={searchWrapRef} style={{ flex: '0 1 520px', padding: '0 18px', position: 'relative' }}>
            <input
              placeholder="Search modules, menus, reference numbers…"
              aria-label="Global search"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                if (!e.target.value.trim()) {
                  setSearchResults([]);
                  setSearchOpen(false);
                  setSearchError(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchValue.trim();
                  if (!q) return;
                  runSearch(q);
                }
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(237,186,53,0.60)';
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(237,186,53,0.18)';
                if (searchResults.length > 0 || searchError) setSearchOpen(true);
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: COLORS.white,
                padding: '0 12px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />

            {searchOpen ? (
              <div
                role="listbox"
                style={{
                  position: 'absolute',
                  top: 44,
                  left: 18,
                  right: 18,
                  background: '#0B0C1E',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                  zIndex: 30,
                }}
              >
                <div style={{ padding: '10px 12px', fontSize: 12, opacity: 0.9, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                  {searchLoading ? 'Searching…' : searchError ? searchError : `Results for “${searchValue.trim()}”`}
                </div>
                {searchLoading ? null : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {(() => {
                      const groups = groupResults(searchResults);
                      const groupOrder: Array<{ key: GlobalSearchResultItem['type']; label: string }> = [
                        { key: 'ROUTE', label: 'Menu' },
                        { key: 'JOURNAL', label: 'Journals' },
                        { key: 'BANK_STATEMENT', label: 'Bank Statements' },
                        { key: 'IMPREST', label: 'Imprest' },
                      ];

                      const sections = groupOrder.filter((g) => (groups[g.key] ?? []).length > 0);
                      if (sections.length === 0) {
                        return <div style={{ padding: 12, fontSize: 13, opacity: 0.88 }}>No results found.</div>;
                      }

                      return sections.map((g) => (
                        <div key={g.key}>
                          <div style={{ padding: '10px 12px', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.75 }}>
                            {g.label}
                          </div>
                          {(groups[g.key] ?? []).map((r, idx) => (
                            <button
                              key={`${g.key}-${idx}-${r.targetUrl}`}
                              type="button"
                              role="option"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchValue('');
                                setSearchResults([]);
                                navigate(r.targetUrl);
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                border: 0,
                                background: 'transparent',
                                color: COLORS.white,
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                height: 24,
                padding: '0 10px',
                borderRadius: 999,
                background: envBadge.bg,
                border: `1px solid ${envBadge.border}`,
                color: envBadge.color,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.8,
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title={`Environment: ${envBadge.env}`}
            >
              {envBadge.env}
            </div>

            <button
              type="button"
              title="Notifications (coming soon)"
              disabled
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                placeItems: 'center',
                color: 'rgba(255,255,255,0.55)',
                cursor: 'not-allowed',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div style={{ fontSize: 12, opacity: 0.92, whiteSpace: 'nowrap' }} title={tenantName ? `Tenant: ${tenantName}` : ''}>
              {tenantName ? `Tenant: ${tenantName}` : ''}
            </div>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                border: 0,
                background: 'transparent',
                color: COLORS.white,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '14px' }}>
                <div style={{ fontSize: 12, fontWeight: 750, whiteSpace: 'nowrap' }}>{userEmail}</div>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      <ProfileDrawer />

      <div
        style={{
          flex: 1,
          marginLeft: SIDEBAR_WIDTH,
          height: '100vh',
          overflowY: 'auto',
          padding: 24,
          paddingTop: 24 + (showTopBar ? TOPBAR_HEIGHT : 0),
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <AuthBootstrapGate>
            <Outlet />
          </AuthBootstrapGate>
        </div>
      </div>
    </div>
  );
}
