import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Receipt,
  Settings,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canAny } from '../auth/permissions';
import { PERMISSIONS } from '../auth/permission-catalog';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import type React from 'react';
import { apiFetch, getApiErrorMessage, pingSession } from '../services/api';
import { changeMyPassword, updateMyProfile, uploadMyAvatar } from '../services/users';
import { tokens } from '../designTokens';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const brand = useBranding();
  const { effective } = brand;
  const [brandLogoOk, setBrandLogoOk] = useState(true);

  function formatRoleLabel(input: unknown): string {
    const raw = String(input ?? '').trim();
    if (!raw) return '';
    return raw
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

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

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuWrapRef = useRef<HTMLDivElement | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const notificationsWrapRef = useRef<HTMLDivElement | null>(null);

  const { state, logout, hasPermission, refreshMe } = useAuth();

  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  const WARNING_AT_MS = 14 * 60 * 1000;

  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(60);
  const lastActivityAtRef = useRef<number>(Date.now());
  const sessionWarningOpenRef = useRef(false);
  const idleIntervalRef = useRef<number | null>(null);
  const logoutInProgressRef = useRef(false);

  const isGatewayRoute = location.pathname.startsWith('/login')
    || location.pathname.startsWith('/forgot-password')
    || location.pathname.startsWith('/reset-password')
    || location.pathname.startsWith('/force-password-reset');

  useEffect(() => {
    sessionWarningOpenRef.current = sessionWarningOpen;
  }, [sessionWarningOpen]);

  useEffect(() => {
    if (!state.isAuthenticated || isGatewayRoute) return;

    function bumpActivity() {
      lastActivityAtRef.current = Date.now();
      if (sessionWarningOpenRef.current) {
        setSessionWarningOpen(false);
        setSessionCountdown(60);
      }
    }

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('keydown', bumpActivity, opts);
    window.addEventListener('click', bumpActivity, opts);
    window.addEventListener('scroll', bumpActivity, opts);
    window.addEventListener('touchstart', bumpActivity, opts);

    return () => {
      window.removeEventListener('keydown', bumpActivity);
      window.removeEventListener('click', bumpActivity);
      window.removeEventListener('scroll', bumpActivity);
      window.removeEventListener('touchstart', bumpActivity);
    };
  }, [isGatewayRoute, state.isAuthenticated]);

  useEffect(() => {
    if (!state.isAuthenticated || isGatewayRoute) {
      if (idleIntervalRef.current) {
        window.clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
      setSessionWarningOpen(false);
      setSessionCountdown(60);
      lastActivityAtRef.current = Date.now();
      logoutInProgressRef.current = false;
      return;
    }

    if (idleIntervalRef.current) return;
    idleIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const idleMs = Math.max(0, now - lastActivityAtRef.current);

      if (!sessionWarningOpenRef.current && idleMs >= WARNING_AT_MS && idleMs < IDLE_TIMEOUT_MS) {
        setSessionWarningOpen(true);
      }

      if (sessionWarningOpenRef.current) {
        const remainingSeconds = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idleMs) / 1000));
        setSessionCountdown(remainingSeconds);
      }

      if (idleMs >= IDLE_TIMEOUT_MS && !logoutInProgressRef.current) {
        logoutInProgressRef.current = true;
        void (async () => {
          await logout();
          navigate('/login?reason=timeout', { replace: true });
        })();
      }
    }, 1000);

    return () => {
      if (idleIntervalRef.current) {
        window.clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
    };
  }, [isGatewayRoute, state.isAuthenticated]);

  async function handleStayLoggedIn() {
    if (logoutInProgressRef.current) return;
    try {
      await pingSession();
      lastActivityAtRef.current = Date.now();
      setSessionWarningOpen(false);
      setSessionCountdown(60);
    } catch {
      logoutInProgressRef.current = true;
      void (async () => {
        await logout();
        navigate('/login?reason=timeout', { replace: true });
      })();
    }
  }

  function handleLogoutNow() {
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    void (async () => {
      await logout();
      navigate('/login?reason=logout', { replace: true });
    })();
  }

  const tenantName = state.me?.tenant?.name ?? '';
  const userEmail = state.me?.user?.email ?? '';
  const userRoles = Array.isArray(state.me?.user?.roles) ? state.me?.user?.roles : [];

  const userFullName = String(state.me?.user?.name ?? '').trim();
  const userFirstName = userFullName ? userFullName.split(/\s+/).filter(Boolean)[0] ?? '' : '';
  const userDisplayName = (userFullName || userFirstName || userEmail).trim();
  const userInitials = (() => {
    const src = userFullName || userEmail;
    const parts = String(src)
      .trim()
      .split(/\s+|\.|@|_/)
      .filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? '';
    const out = `${a}${b}`.toUpperCase();
    return out || 'U';
  })();

  const primaryRole = userRoles[0] ?? '';
  const primaryRoleLabel = primaryRole ? formatRoleLabel(primaryRole) : '';

  const isDelegated = Boolean(state.delegation?.delegationId);
  const actingAsName = state.delegation?.actingAsUserName;
  const realUserName = state.me?.user?.name ?? userEmail;

  const avatarUrl = state.me?.user?.avatarUrl ?? null;
  const avatarSrc = useMemo(() => {
  if (!avatarUrl) return '';

  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }

  if (avatarUrl.startsWith('/uploads/')) {
    return `${window.location.origin}${avatarUrl}`;
  }

  if (avatarUrl.startsWith('/')) {
    const base = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');

    return `${base}${avatarUrl}`;
  }

  return avatarUrl;
}, [avatarUrl]);

  type NavSearchItem = {
    title: string;
    category: string;
    route: string;
    icon: React.ReactNode;
    keywords?: string[];
  };

  const NAV_SEARCH_INDEX: NavSearchItem[] = useMemo(
    () => [
      { title: 'Dashboard', category: 'Home', route: '/', icon: <LayoutDashboard size={16} aria-hidden /> },
      { title: 'Chart of Accounts', category: 'Finance & Accounting', route: '/finance/coa', icon: <Landmark size={16} aria-hidden />, keywords: ['coa', 'accounts', 'ledger'] },
      { title: 'COA Health', category: 'Finance & Accounting', route: '/finance/coa-health', icon: <Gauge size={16} aria-hidden />, keywords: ['coa', 'health', 'validation'] },
      { title: 'COA Submissions', category: 'Finance & Accounting', route: '/finance/coa-submissions', icon: <FileText size={16} aria-hidden />, keywords: ['coa', 'submissions', 'approval'] },
      { title: 'General Ledger', category: 'Finance & Accounting', route: '/finance/gl', icon: <Wallet size={16} aria-hidden />, keywords: ['gl', 'journals', 'ledger'] },
      { title: 'Journals', category: 'Finance & Accounting', route: '/finance/gl/journals', icon: <Receipt size={16} aria-hidden />, keywords: ['journal', 'entries', 'posting'] },
      { title: 'Accounts Payable', category: 'Finance & Accounting', route: '/ap', icon: <CreditCard size={16} aria-hidden />, keywords: ['ap', 'suppliers', 'bills'] },
      { title: 'Accounts Receivable', category: 'Finance & Accounting', route: '/ar', icon: <Receipt size={16} aria-hidden />, keywords: ['ar', 'customers', 'invoices'] },
      { title: 'Cash & Bank', category: 'Finance & Accounting', route: '/cash', icon: <Landmark size={16} aria-hidden />, keywords: ['bank', 'cashbook', 'cash book', 'reconciliation'] },
      { title: 'Budgets', category: 'Planning', route: '/budgets', icon: <BarChart3 size={16} aria-hidden />, keywords: ['budget', 'planning', 'forecast'] },
      { title: 'Reports', category: 'Analytics & Reporting', route: '/reports', icon: <FileText size={16} aria-hidden />, keywords: ['report', 'analytics'] },
      { title: 'Tax Rates', category: 'Master Data', route: '/settings/tax-rates', icon: <Receipt size={16} aria-hidden />, keywords: ['vat', 'tax', 'rates'] },
      { title: 'Users', category: 'Administration', route: '/settings/users', icon: <Users size={16} aria-hidden />, keywords: ['user', 'roles', 'access'] },
      { title: 'Settings', category: 'Administration', route: '/settings', icon: <Settings size={16} aria-hidden />, keywords: ['configuration', 'admin'] },
      { title: 'Override Sessions', category: 'Administration', route: '/settings/governance/override-sessions', icon: <ClipboardList size={16} aria-hidden />, keywords: ['governance', 'override', 'approval', 'exceptions'] },
      { title: 'Preferences', category: 'Account', route: '/preferences', icon: <Settings size={16} aria-hidden />, keywords: ['theme', 'compact', 'language'] },
      { title: 'Change Password', category: 'Account', route: '/change-password', icon: <Lock size={16} aria-hidden />, keywords: ['security', 'password'] },
      { title: 'Activity Log', category: 'Account', route: '/activity-log', icon: <ClipboardList size={16} aria-hidden />, keywords: ['audit', 'security'] },
    ],
    [],
  );

  const filteredNavResults = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return [] as NavSearchItem[];

    const scored = NAV_SEARCH_INDEX.map((item) => {
      const haystack = [item.title, item.category, item.route, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return { item, score: -1 };
      let score = 1;
      if (item.title.toLowerCase().startsWith(q)) score += 4;
      if ((item.keywords ?? []).some((k) => k.toLowerCase().startsWith(q))) score += 2;
      if (item.route.toLowerCase().includes(q)) score += 1;
      return { item, score };
    })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));

    return scored.slice(0, 14).map((s) => s.item);
  }, [NAV_SEARCH_INDEX, searchValue]);

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

  useEffect(() => {
    if (!notificationOpen) return;

    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (notificationOpen && notificationsWrapRef.current && t && !notificationsWrapRef.current.contains(t)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notificationOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (userMenuOpen && userMenuWrapRef.current && t && !userMenuWrapRef.current.contains(t)) {
        setUserMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  async function fetchUnreadCount() {
    try {
      const res = await apiFetch<{ count: number }>('/notifications/unread-count');
      setUnreadCount(Number((res as any)?.count ?? 0) || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function fetchNotifications() {
    setNotificationError(null);
    try {
      const res = await apiFetch<any[]>('/notifications');
      setNotifications(Array.isArray(res) ? res : []);
    } catch (e) {
      setNotificationError(getApiErrorMessage(e, 'Failed to load notifications'));
      setNotifications([]);
    }
  }

  async function markAllAsRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      // ignore
    }
    void fetchNotifications();
    void fetchUnreadCount();
  }

  useEffect(() => {
    if (!state.isAuthenticated || isGatewayRoute) return;
    void fetchUnreadCount();
  }, [state.isAuthenticated, isGatewayRoute]);

  async function handleNotificationClick(n: any) {
    try {
      await apiFetch(`/notifications/${String(n?.id ?? '')}/read`, { method: 'PATCH' });
    } catch {
      // ignore
    }

    const entityType = String(n?.entityType ?? '');
    const entityId = String(n?.entityId ?? '');
    if (entityType === 'ACCOUNT' && entityId) {
      navigate(`/finance/coa?highlight=${encodeURIComponent(entityId)}`);
    }

    setNotificationOpen(false);
    void fetchNotifications();
    void fetchUnreadCount();
  }

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
                navigate('/login?reason=logout', { replace: true });
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

  function openNavResult(item: NavSearchItem) {
    setSearchOpen(false);
    setSearchValue('');
    setSearchError(null);
    setSearchLoading(false);
    setActiveSearchIndex(0);
    navigate(item.route);
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

  type L1Key = 'finance' | null;
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

  const [openGlL3, setOpenGlL3] = useState<{ recurring: boolean }>({
    recurring: false,
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

  const glActiveL3 = useMemo(() => {
    return {
      recurring: path.startsWith('/finance/gl/recurring'),
    };
  }, [path]);

  useEffect(() => {
    if (glActiveL3.recurring) {
      setOpenGlL3((s) => ({ ...s, recurring: true }));
    }
  }, [glActiveL3.recurring]);

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



  const COLORS = {
    navy: 'var(--uspire-navy)',
    gold: 'var(--uspire-gold)',
    white: '#FCFCFC',
  };

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

  const sessionWarningModal = sessionWarningOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '95%',
          maxWidth: 520,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            background: COLORS.navy,
            color: '#FCFCFC',
            padding: '16px 18px',
            fontWeight: 900,
            letterSpacing: 0.2,
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          Session Expiring Soon
        </div>
        <div
          style={{
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(8,10,28,0.92)' }}>
            You will be logged out in
          </div>
          <div style={{ fontSize: 36, fontWeight: 950, letterSpacing: 0.2, color: 'rgba(8,10,28,0.92)', lineHeight: 1.05 }}>
            {Math.max(0, sessionCountdown)}s
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(8,10,28,0.70)', lineHeight: 1.55 }}>
            due to inactivity.
          </div>

          <div
            style={{
              marginTop: 6,
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleStayLoggedIn}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: 0,
                background: COLORS.navy,
                color: '#FCFCFC',
                fontWeight: 900,
                cursor: 'pointer',
                minWidth: 150,
              }}
            >
              Stay Logged In
            </button>
            <button
              type="button"
              onClick={handleLogoutNow}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 12,
                border: '1px solid rgba(183, 28, 28, 0.38)',
                background: 'rgba(183, 28, 28, 0.06)',
                color: 'rgba(183, 28, 28, 0.92)',
                fontWeight: 900,
                cursor: 'pointer',
                minWidth: 150,
              }}
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;


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

  const TOPBAR_HEIGHT = 60;

  const SIDEBAR_WIDTH = 280;

  const hasFinanceViewAll = hasPermission(PERMISSIONS.FINANCE.VIEW_ALL);
  const hasSystemConfigView = hasPermission(PERMISSIONS.SYSTEM.CONFIG_VIEW);
  const hasSystemSettingsView = hasPermission(PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW);
  const hasFinanceConfigView = hasPermission(PERMISSIONS.FINANCE.CONFIG_VIEW);
  const hasUserView = hasPermission(PERMISSIONS.USER.VIEW);
  const hasRoleView = hasPermission(PERMISSIONS.ROLE.VIEW);

  const hasFinancialGovernanceView =
    hasPermission((PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.VIEW) ||
    hasPermission((PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.MANAGE);

  const hasSystemGovView =
    hasPermission((PERMISSIONS as any).GOVERNANCE?.SYSTEM?.VIEW) ||
    hasSystemConfigView ||
    hasSystemSettingsView;

  const showAudit = hasPermission(PERMISSIONS.AUDIT_VIEW);

  const showArAging =
    hasPermission(PERMISSIONS.AR_AGING.VIEW) || hasFinanceViewAll;
  const showArStatements =
    hasPermission(PERMISSIONS.AR_STATEMENT.VIEW) || hasFinanceViewAll;
  const showSupplierStatements =
    hasPermission(PERMISSIONS.REPORT.SUPPLIER_STATEMENT_VIEW) ||
    hasFinanceViewAll;
  const showApAging =
    hasPermission(PERMISSIONS.REPORT.AP_AGING_VIEW) || hasFinanceViewAll;
  const showPaymentProposals =
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW) ||
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE) ||
    hasPermission(PERMISSIONS.AP.PAYMENT_PROPOSAL_APPROVE) ||
    hasFinanceViewAll;
  const showPaymentRuns =
    hasPermission(PERMISSIONS.AP.PAYMENT_RUN_VIEW) || hasFinanceViewAll;
  const showArReminders =
    hasPermission(PERMISSIONS.AR_REMINDER.VIEW) || hasFinanceViewAll;
  const showGlCreate = hasPermission(PERMISSIONS.GL.CREATE);
  const showGlView = hasPermission(PERMISSIONS.GL.VIEW) || hasFinanceViewAll;
  const showGlReviewQueue = hasPermission(PERMISSIONS.GL.APPROVE);
  const showGlPostQueue = hasPermission(PERMISSIONS.GL.FINAL_POST);
  const showGlRecurring =
    hasPermission(PERMISSIONS.GL.RECURRING_VIEW) ||
    hasPermission(PERMISSIONS.GL.RECURRING_MANAGE) ||
    hasPermission(PERMISSIONS.GL.RECURRING_GENERATE);
  const showGlRiskIntelligence = showGlView;
  const showGlRegister = showGlView;
  const showGlDrafts = showGlCreate;
  const showCoa = hasPermission(PERMISSIONS.COA.VIEW) || hasFinanceViewAll;
  const showCoaSubmissions =
    hasPermission(PERMISSIONS.COA.DRAFT_CREATE)
    || hasPermission(PERMISSIONS.COA.DRAFT_EDIT)
    || hasPermission(PERMISSIONS.COA.DRAFT_SUBMIT)
    || hasFinanceViewAll
    ;
  const showCoaApprovals = hasPermission(PERMISSIONS.COA.APPROVE) || hasFinanceViewAll;
  const showPeriods =
    hasFinanceViewAll ||
    hasSystemGovView ||
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

  useEffect(() => {
    const isDev = Boolean((import.meta as any)?.env?.DEV);
    if (!isDev) return;
    if (!showCoaSubmissions) {
      console.warn(`Sidebar item hidden due to missing permission: ${PERMISSIONS.COA.DRAFT_CREATE} / ${PERMISSIONS.COA.DRAFT_EDIT} / ${PERMISSIONS.COA.DRAFT_SUBMIT} (/finance/coa/submissions)`);
    }
    if (!showCoaApprovals) {
      console.warn(`Sidebar item hidden due to missing permission: ${PERMISSIONS.COA.APPROVE} (/finance/coa/approvals)`);
    }
  }, [showCoaSubmissions, showCoaApprovals]);

  const showArCustomers =
    hasPermission(PERMISSIONS.CUSTOMERS.VIEW) || hasFinanceViewAll;
  const showArInvoices =
    hasPermission(PERMISSIONS.AR.INVOICE_VIEW) ||
    hasPermission(PERMISSIONS.AR.INVOICE_CREATE) ||
    hasFinanceViewAll;
  const showArReceipts =
    hasPermission(PERMISSIONS.AR.RECEIPT_VIEW) ||
    hasPermission(PERMISSIONS.AR.RECEIPT_POST) ||
    hasPermission(PERMISSIONS.AR.RECEIPT_CREATE) ||
    hasFinanceViewAll;
  const showArCreditNotes =
    canAny(state.me, [
      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
      PERMISSIONS.AR.CREDIT_NOTE_POST,
    ]) ||
    hasFinanceViewAll;
  const showArRefunds =
    canAny(state.me, [
      PERMISSIONS.AR.REFUND_VIEW,
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_POST,
    ]) ||
    hasFinanceViewAll;

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
    hasFinanceViewAll;

  const showImprest =
    hasFinanceViewAll ||
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
    hasSystemGovView ||
    hasSystemConfigView ||
    hasSystemSettingsView ||
    hasFinanceConfigView ||
    hasFinancialGovernanceView ||
    hasUserView ||
    hasRoleView ||
    hasPermission(PERMISSIONS.SECURITY.DELEGATION_MANAGE);

  const showFinanceNav =
    hasFinanceViewAll ||
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
    <div className="appShell" style={{ background: COLORS.white }}>
      {sessionWarningModal}
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

                    {showCoa ? <SidebarLink to="/finance/coa/health" label="COA Health" icon={<BarChartIcon />} level={2} /> : null}

                    {showCoaSubmissions ? (
                      <SidebarLink to="/finance/coa/submissions" label="My COA Submissions" icon={<FileTextIcon />} level={2} />
                    ) : null}

                    {showCoaApprovals ? (
                      <SidebarLink to="/finance/coa/approvals" label="COA Approvals" icon={<ClipboardIcon />} level={2} />
                    ) : null}

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
                        {showGlRecurring ? (
                          <>
                            <SidebarToggle
                              label="Recurring Journals"
                              icon={<RepeatIcon />}
                              open={openGlL3.recurring}
                              active={glActiveL3.recurring}
                              level={3}
                              onToggle={() => setOpenGlL3((s) => ({ ...s, recurring: !s.recurring }))}
                            />
                            {openGlL3.recurring ? (
                              <div style={{ paddingLeft: 16, display: 'grid', gap: 6 }}>
                                <SidebarLink to="/finance/gl/recurring" end label="Templates" icon={<FileTextIcon />} level={3} />
                              </div>
                            ) : null}
                          </>
                        ) : null}
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

            {showSettings ? (
              <SidebarLink
                to="/settings"
                label="Settings"
                icon={<SettingsIcon />}
                level={1}
                activeMatch={(loc) => loc.pathname.startsWith('/settings')}
              />
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
          className="header-container"
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
            boxShadow: '0 8px 18px rgba(11,11,71,0.18)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontWeight: 750, fontSize: 14, letterSpacing: 0.2, whiteSpace: 'nowrap', opacity: 0.98 }}>
            {breadcrumbDisplay}
          </div>

          {isDelegated ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(231,158,19,0.10)',
                border: '1px solid rgba(231,158,19,0.28)',
                color: 'rgba(255,255,255,0.95)',
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
              title={realUserName ? `You are logged in as ${realUserName}` : ''}
            >
              <span
                style={{
                  display: 'inline-flex',
                  height: 20,
                  padding: '0 8px',
                  borderRadius: 999,
                  background: 'rgba(231,158,19,0.22)',
                  border: '1px solid rgba(231,158,19,0.34)',
                  color: 'rgba(255,255,255,0.98)',
                  alignItems: 'center',
                  fontSize: 11,
                  letterSpacing: 0.5,
                }}
              >
                Delegated
              </span>
              <span style={{ opacity: 0.95 }}>
                Acting as: {actingAsName ?? 'Delegated User'}
              </span>
              <button
                type="button"
                onClick={handleLogoutNow}
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.06)',
                  color: COLORS.white,
                  cursor: 'pointer',
                  fontWeight: 850,
                  fontSize: 11.5,
                }}
              >
                Stop Delegation
              </button>
            </div>
          ) : null}

          <div ref={searchWrapRef} style={{ flex: '0 1 520px', padding: '0 18px', position: 'relative' }}>
            <input
              placeholder="Search modules, menus, reference numbers..."
              aria-label="Global search"
              type="search"
              name="global-search"
              autoComplete="off"
              value={searchValue}
              onChange={(e) => {
                const next = e.target.value;
                setSearchValue(next);
                setSearchError(null);
                setSearchLoading(false);
                setActiveSearchIndex(0);
                setSearchOpen(Boolean(next.trim()));
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchOpen(Boolean(searchValue.trim()));
                  setActiveSearchIndex((i) => {
                    const max = Math.max(0, filteredNavResults.length - 1);
                    return Math.min(max, i + 1);
                  });
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchOpen(Boolean(searchValue.trim()));
                  setActiveSearchIndex((i) => Math.max(0, i - 1));
                }
                if (e.key === 'Enter') {
                  const q = searchValue.trim();
                  if (!q) return;
                  const item = filteredNavResults[activeSearchIndex];
                  if (item) openNavResult(item);
                }
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.focusRing.borderColor;
                e.currentTarget.style.boxShadow = tokens.focusRing.ring;
                if (searchValue.trim()) setSearchOpen(true);
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
                  background: COLORS.navy,
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                  zIndex: 30,
                }}
              >
                <div style={{ padding: '10px 12px', fontSize: 12, opacity: 0.9, borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                  {searchError ? searchError : searchLoading ? 'Searching…' : 'Navigate'}
                </div>

                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {!searchValue.trim() ? (
                    <div style={{ padding: 12, fontSize: 13, opacity: 0.88 }}>Type to search modules and menus.</div>
                  ) : filteredNavResults.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, opacity: 0.88 }}>No results found.</div>
                  ) : (
                    <div style={{ padding: 6 }}>
                      {filteredNavResults.map((r, idx) => {
                        const active = idx === activeSearchIndex;
                        return (
                          <button
                            key={`${r.route}-${idx}`}
                            type="button"
                            role="option"
                            aria-selected={active ? 'true' : 'false'}
                            onMouseEnter={() => setActiveSearchIndex(idx)}
                            onClick={() => openNavResult(r)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 10px',
                              border: 0,
                              borderRadius: 10,
                              background: active ? 'rgba(231,158,19,0.16)' : 'transparent',
                              color: COLORS.white,
                              cursor: 'pointer',
                              fontSize: 13,
                              display: 'grid',
                              gridTemplateColumns: '22px 1fr',
                              gap: 10,
                              alignItems: 'start',
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 8,
                                display: 'grid',
                                placeItems: 'center',
                                background: active ? 'rgba(231,158,19,0.24)' : 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: active ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.90)',
                                marginTop: 1,
                              }}
                            >
                              {r.icon}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                              <span style={{ display: 'block', marginTop: 2, fontSize: 12, opacity: 0.82, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {r.category}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            <div ref={notificationsWrapRef} className="notification-wrapper" style={{ position: 'relative' }}>
              <button
                type="button"
                title="Notifications"
                onClick={() => {
                  const next = !notificationOpen;
                  setNotificationOpen(next);
                  if (next) {
                    void fetchNotifications();
                    void fetchUnreadCount();
                  }
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(255,255,255,0.92)',
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {unreadCount > 0 ? (
                <span className="notification-badge">{Math.min(99, unreadCount)}</span>
              ) : null}

              {notificationOpen ? (
                <div className="notification-dropdown" role="menu" aria-label="Notifications">
                  <div className="notification-header">
                    <span className="notification-title">Notifications</span>
                    <button type="button" className="mark-all-read" onClick={markAllAsRead}>Mark all as read</button>
                  </div>

                  <div className="notification-list">
                    {notificationError ? (
                      <div className="notification-empty">{notificationError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="notification-empty">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={String(n?.id ?? '')}
                          type="button"
                          className={`notification-item ${n?.isRead ? '' : 'unread'}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="notification-title">{String(n?.title ?? '')}</div>
                          <div className="notification-message">{String(n?.message ?? '')}</div>
                          <div className="notification-time">{n?.createdAt ? new Date(String(n.createdAt)).toLocaleString() : ''}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 12, opacity: 0.92, whiteSpace: 'nowrap' }} title={tenantName ? `Tenant: ${tenantName}` : ''}>
              {tenantName ? `Tenant: ${tenantName}` : ''}
            </div>

            <div ref={userMenuWrapRef} className="user-menu-wrapper">
              <button
                type="button"
                className="user-trigger"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((v) => !v)}
                title={userEmail}
              >
                <div className="user-avatar" aria-hidden>
                  {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{userInitials}</span>}
                  <span className="user-online" aria-hidden />
                </div>
                <div className="user-identity">
                  <div className="user-name">{userDisplayName}</div>
                </div>
                <svg className="user-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {userMenuOpen ? (
                <div className="user-dropdown" role="menu" aria-label="User menu">
                  <div className="user-dropdown-summary">
                    <div className="user-dropdown-name" title={userFullName || userDisplayName}>{userFullName || userDisplayName}</div>
                    <div className="user-dropdown-meta" title={primaryRoleLabel || ''}>{primaryRoleLabel || '—'}</div>
                    <div className="user-dropdown-meta" title={tenantName || ''}>{tenantName || '—'}</div>
                  </div>

                  <button
                    type="button"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setProfileOpen(true);
                    }}
                  >
                    <User size={16} className="user-dropdown-icon" aria-hidden />
                    My Profile
                  </button>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/preferences');
                    }}
                  >
                    <Settings size={16} className="user-dropdown-icon" aria-hidden />
                    My Preferences
                  </button>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/change-password');
                    }}
                  >
                    <Lock size={16} className="user-dropdown-icon" aria-hidden />
                    Change Password
                  </button>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/activity-log');
                    }}
                  >
                    <ClipboardList size={16} className="user-dropdown-icon" aria-hidden />
                    Activity Log
                  </button>

                  <div className="user-dropdown-divider" />

                  <button
                    type="button"
                    className="user-dropdown-item user-dropdown-logout"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogoutNow();
                    }}
                  >
                    <LogOut size={16} className="user-dropdown-icon" aria-hidden />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ProfileDrawer />

      <div
  className="mainContent"
  style={{
    marginLeft: SIDEBAR_WIDTH,
    padding: 24,
    paddingTop: 24 + (showTopBar ? TOPBAR_HEIGHT : 0),
    boxSizing: 'border-box',

    height: '100vh',
    overflow: 'hidden',

    display: 'flex',
    flexDirection: 'column',
  }}
>
  <div
    className="pageContent"
    style={{
      width: '100%',
      maxWidth: 1400,
      margin: '0 auto',

      flex: 1,
      minHeight: 0,

      display: 'flex',
      flexDirection: 'column',

      overflowX: 'hidden',
      overflowY: 'auto',
    }}
  >
    <Outlet />
  </div>
</div>
</div>
  );
}
