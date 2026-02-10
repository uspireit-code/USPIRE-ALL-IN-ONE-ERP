import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, EyeOff, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { LoginRequires2faResponse, LoginRequiresTenantResponse, LoginResponse } from '../auth/auth.types';
import { DelegationSelectorModal } from '../components/DelegationSelectorModal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { tokens } from '../designTokens';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { API_BASE_URL } from '../services/api';
import { SYSTEM_ADMIN_CONTACT } from '../config/support';

export function LoginPage() {
  const { login, verify2fa, activateDelegation, clearDelegationChoice, state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { effective } = useBranding();
  const [logoOk, setLogoOk] = useState(true);

  const [tenantId, setTenantId] = useState('');
  const [advancedLogin, setAdvancedLogin] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const [phase, setPhase] = useState<'LOGIN' | 'VERIFY_2FA'>('LOGIN');
  const [challenge, setChallenge] = useState<null | LoginRequires2faResponse>(null);

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reasonBanner, setReasonBanner] = useState<string | null>(null);
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const envLabel = useMemo(() => {
    const mode = String(import.meta.env.MODE ?? '').toLowerCase();
    if (mode === 'production') return 'Production Environment';
    if (mode === 'development') return 'Development Environment';
    return 'Testing Environment';
  }, []);

  const FORCE_RESET_FLAG_KEY = 'forceResetRequired';
  const FORCE_RESET_EMAIL_KEY = 'forceResetEmail';
  const FORCE_RESET_TENANT_KEY = 'forceResetTenantId';

  function resolveLockedMessage(raw: unknown) {
    const text = String(raw ?? '').toLowerCase();
    if (!text) return null;

    if (text.includes('password_locked') || text.includes('account locked') || text.includes('locked')) {
      return 'Your account has been temporarily locked due to multiple failed login attempts. Please try again later or contact your System Administrator.';
    }

    return null;
  }

  const showTenantField = tenantRequired || advancedLogin;

  function resolveLoginErrorMessage(err: any) {
    const body = err?.body;
    const code = typeof body?.error === 'string' ? body.error : '';
    const remainingAttempts = typeof body?.remainingAttempts === 'number' ? body.remainingAttempts : undefined;

    if (code === 'ACCOUNT_LOCKED') {
      return 'Your account has been locked due to multiple failed login attempts. Please contact your System Administrator.';
    }

    if (code === 'INVALID_CREDENTIALS') {
      const suffix = typeof remainingAttempts === 'number'
        ? ` Remaining attempts: ${remainingAttempts}. Warning: this account will be locked after 5 failed login attempts.`
        : ' Warning: this account will be locked after 5 failed login attempts.';
      return `Invalid credentials.${suffix}`;
    }

    if (code === 'SESSION_EXISTS') {
      return 'This account is already logged in on another device. Please logout from the other session before continuing. If you cannot access the other session, contact your System Administrator.';
    }

    const locked = resolveLockedMessage(body?.reason ?? body?.message ?? body?.error ?? err?.message);
    if (locked) return locked;

    const msg = body?.message ?? body?.error ?? 'Login failed';
    return typeof msg === 'string' ? msg : JSON.stringify(msg);
  }

  async function onSubmitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setSuccess(null);
    setLoading(true);

    try {
      const resp: LoginResponse = await login({
        tenantId: showTenantField && tenantId.trim() ? tenantId.trim() : undefined,
        emailOrUsername: emailOrUsername.trim(),
        password,
      });

      if ((resp as LoginRequiresTenantResponse)?.requiresTenant) {
        setTenantRequired(true);
        setAdvancedLogin(true);
        setError((resp as LoginRequiresTenantResponse).message || 'Tenant resolution required');
        return;
      }

      if ((resp as LoginRequires2faResponse)?.requires2fa) {
        const c = resp as LoginRequires2faResponse;
        setChallenge(c);
        setPhase('VERIFY_2FA');
        setOtp('');
        return;
      }

      if ((resp as any)?.requiresPasswordReset) {
        sessionStorage.setItem(FORCE_RESET_FLAG_KEY, 'true');
        sessionStorage.setItem(FORCE_RESET_EMAIL_KEY, emailOrUsername.trim());
        sessionStorage.setItem(
          FORCE_RESET_TENANT_KEY,
          showTenantField && tenantId.trim() ? tenantId.trim() : '',
        );
        navigate('/force-password-reset', { replace: true });
        return;
      }

      sessionStorage.removeItem(FORCE_RESET_FLAG_KEY);
      sessionStorage.removeItem(FORCE_RESET_EMAIL_KEY);
      sessionStorage.removeItem(FORCE_RESET_TENANT_KEY);

      const availableDelegations = Array.isArray((resp as any)?.availableDelegations)
        ? ((resp as any).availableDelegations as any[])
        : [];

      if (availableDelegations.length > 0) {
        setDelegationModalOpen(true);
        return;
      }

      const sp = new URLSearchParams(location.search);
      const next = sp.get('next');
      navigate(next && next.startsWith('/') ? next : '/', { replace: true });
    } catch (err: any) {
      const code = typeof err?.body?.error === 'string' ? err.body.error : null;
      setErrorCode(code);
      setError(resolveLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestUnlock() {
    const email = emailOrUsername.trim();
    if (!email) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const url = `${API_BASE_URL}/auth/request-unlock`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, tenantId: showTenantField && tenantId.trim() ? tenantId.trim() : undefined }),
      });

      if (!res.ok) {
        setError('Failed to submit unlock request. Please try again later.');
        return;
      }

      const data: any = await res.json().catch(() => ({}));
      setSuccess(typeof data?.message === 'string' ? data.message : 'Unlock request has been sent to your System Administrator.');
    } catch {
      setError('Failed to submit unlock request. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit2fa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!challenge?.challengeId) return;
    setError(null);
    setLoading(true);
    try {
      await verify2fa({ challengeId: challenge.challengeId, otp });
      const sp = new URLSearchParams(location.search);
      const next = sp.get('next');
      navigate(next && next.startsWith('/') ? next : '/', { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Unable to verify identity. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Unable to verify identity. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const reason = (sp.get('reason') ?? '').trim().toLowerCase();
    if (!reason) {
      setReasonBanner(null);
      return;
    }

    const msg =
      reason === 'timeout'
        ? 'Your session expired due to inactivity. Please sign in again.'
        : reason === 'logout'
          ? 'You have been signed out successfully.'
          : reason === 'delegation_expired'
            ? 'Your delegated session expired. Please login again.'
          : reason === 'unauthorized'
            ? 'Your session is no longer valid. Please sign in again.'
            : reason === 'session_exists'
              ? 'Login blocked: This account is already active in another session. Please logout from the other session before trying again.'
              : reason === 'locked'
                ? 'Your account has been locked due to multiple failed login attempts. Please contact your System Administrator.'
                : reason === 'disabled'
                  ? 'This account has been disabled. Please contact your System Administrator.'
                  : reason === 'password_reset_success'
                    ? 'Password reset successful. You may now sign in using your new password.'
                    : null;

    setReasonBanner(msg);
  }, [location.search]);

  function clearReasonBannerOnInput(nextValue: string) {
    if (!reasonBanner) return;
    if (String(nextValue ?? '').trim()) setReasonBanner(null);
  }

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const cardMaxWidth = 640;
  const currentYear = new Date().getFullYear();

  const errorBox = error ? (
    <div
      role="alert"
      style={{
        border: '1px solid rgba(183, 28, 28, 0.35)',
        background: 'rgba(183, 28, 28, 0.06)',
        borderRadius: 10,
        padding: '10px 12px',
        color: tokens.colors.text.primary,
        fontSize: 12.5,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Sign in could not be completed</div>
      <div>{error}</div>
    </div>
  ) : null;

  const reasonBannerBox = reasonBanner ? (
    <div
      role="status"
      style={{
        border: '1px solid rgba(2, 68, 133, 0.16)',
        background: 'rgba(2, 68, 133, 0.06)',
        borderRadius: 10,
        padding: '10px 12px',
        color: tokens.colors.text.primary,
        fontSize: 12.5,
        lineHeight: 1.45,
        textAlign: 'center',
      }}
    >
      {reasonBanner}
    </div>
  ) : null;

  const successBox = success ? (
    <div
      role="status"
      style={{
        border: '1px solid rgba(46, 125, 50, 0.28)',
        background: 'rgba(46, 125, 50, 0.06)',
        borderRadius: 10,
        padding: '10px 12px',
        color: tokens.colors.text.primary,
        fontSize: 12.5,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(46, 125, 50, 0.92)' }}>Request submitted</div>
      <div>{success}</div>
    </div>
  ) : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isCompact ? 14 : 22,
        background: 'rgba(11,12,30,0.02)',
      }}
    >
      <DelegationSelectorModal
        open={delegationModalOpen}
        delegations={(state.availableDelegations ?? []) as any}
        onContinueSelf={() => {
          clearDelegationChoice();
          setDelegationModalOpen(false);
          const sp = new URLSearchParams(location.search);
          const next = sp.get('next');
          navigate(next && next.startsWith('/') ? next : '/', { replace: true });
        }}
        onActivate={async ({ delegationId, actingAsUserName }) => {
          await activateDelegation({ delegationId, actingAsUserName });
          setDelegationModalOpen(false);
          const sp = new URLSearchParams(location.search);
          const next = sp.get('next');
          navigate(next && next.startsWith('/') ? next : '/', { replace: true });
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: cardMaxWidth,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: tokens.shadow.card,
          background: tokens.colors.white,
        }}
      >
        <div
          style={{
            background: '#020445',
            color: tokens.colors.white,
            padding: isCompact ? '22px 22px' : '28px 28px',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            {effective?.logoUrl && logoOk ? (
              <img
                src={resolveBrandAssetUrl(effective.logoUrl) ?? ''}
                alt="Organisation logo"
                style={{ maxHeight: 80, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                onError={() => setLogoOk(false)}
              />
            ) : (
              <div
                aria-label="Organisation logo placeholder"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  letterSpacing: 0.4,
                  color: 'rgba(255,255,255,0.88)',
                  userSelect: 'none',
                }}
              >
                U
              </div>
            )}
          </div>

          <div style={{ fontSize: 18, fontWeight: 850, letterSpacing: 0.2 }}>
            USPIRE Enterprise Resource Planning (ERP)
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.86)' }}>
            <div>A controlled enterprise system for finance, operations, people, and performance.</div>
            <div>Built for accountability, compliance, and disciplined decision-making.</div>
          </div>
        </div>

        <div style={{ padding: isCompact ? 22 : 28, background: tokens.colors.white }}>
          <div style={{ marginTop: 2 }}>
          {phase === 'LOGIN' ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: tokens.colors.text.primary }}>Sign in</div>
              <form onSubmit={onSubmitLogin} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reasonBannerBox}
                {showTenantField ? (
                  <div>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Tenant ID</div>
                    <div style={{ marginTop: 6 }}>
                      <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Tenant ID" autoComplete="off" />
                    </div>
                  </div>
                ) : null}

                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Email</div>
                  <div style={{ marginTop: 6 }}>
                    <Input
                      value={emailOrUsername}
                      onChange={(e) => {
                        const v = e.target.value;
                        clearReasonBannerOnInput(v);
                        setEmailOrUsername(v);
                      }}
                      placeholder="Email"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Password</div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ position: 'relative' }}>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          const v = e.target.value;
                          clearReasonBannerOnInput(v);
                          setPassword(v);
                        }}
                        placeholder="Password"
                        autoComplete="off"
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          padding: 4,
                          cursor: 'pointer',
                          color: tokens.colors.text.muted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {errorBox}

                {successBox}

                <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => navigate('/forgot-password')}
                  style={{
                    alignSelf: 'center',
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1a5fb4',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Forgot Password?
                </button>

                {errorCode === 'ACCOUNT_LOCKED' ? (
                  <button
                    type="button"
                    disabled={loading || !emailOrUsername.trim()}
                    onClick={handleRequestUnlock}
                    style={{
                      alignSelf: 'center',
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 750,
                      color: '#1a5fb4',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: loading || !emailOrUsername.trim() ? 'not-allowed' : 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    Request Unlock
                  </button>
                ) : null}

                {!tenantRequired ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setAdvancedLogin((v) => !v)}
                    style={{
                      alignSelf: 'center',
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#1a5fb4',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    {advancedLogin ? 'Hide Tenant ID' : 'Use Tenant ID'}
                  </button>
                ) : null}
              </form>

              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div
                  style={{
                    border: '1px solid rgba(2, 68, 133, 0.14)',
                    background: 'rgba(2, 68, 133, 0.04)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: tokens.colors.text.secondary,
                    textAlign: 'center',
                    lineHeight: 1.45,
                  }}
                >
                  Warning: This system is monitored. Unauthorized access is prohibited and may result in disciplinary and legal action.
                </div>

                <div
                  aria-label="Security assurance"
                  style={{
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    borderRadius: 10,
                    background: 'rgba(11,12,30,0.01)',
                    padding: '10px 12px',
                    display: 'grid',
                    gridTemplateColumns: isCompact ? '1fr 1fr' : 'repeat(4, 1fr)',
                    gap: 10,
                    textAlign: 'center',
                    fontSize: 11.5,
                    color: tokens.colors.text.secondary,
                  }}
                >
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                    <ShieldCheck size={16} color={tokens.colors.text.muted} />
                    <div>Role-based access control</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                    <ClipboardList size={16} color={tokens.colors.text.muted} />
                    <div>Audit logging enabled</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                    <Lock size={16} color={tokens.colors.text.muted} />
                    <div>Session protection active</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                    <Smartphone size={16} color={tokens.colors.text.muted} />
                    <div>2FA supported</div>
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    borderRadius: 10,
                    background: tokens.colors.white,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: tokens.colors.text.secondary,
                    lineHeight: 1.45,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>
                    Need access or locked out? Contact your System Administrator.
                  </div>
                  <div style={{ marginTop: 6 }}>
                    Email:{' '}
                    <a href={`mailto:${SYSTEM_ADMIN_CONTACT.email}`} style={{ color: '#1a5fb4', fontWeight: 700 }}>
                      {SYSTEM_ADMIN_CONTACT.email}
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: tokens.colors.text.primary }}>Verify your identity</div>
              {challenge?.maskedDestination ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: tokens.colors.text.secondary }}>
                  Destination: {challenge.maskedDestination}
                </div>
              ) : null}

              <form onSubmit={onSubmit2fa} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Verification code</div>
                  <div style={{ marginTop: 6 }}>
                    <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="One-time code" autoComplete="off" />
                  </div>
                </div>

                {errorBox}

                <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? 'Verifying…' : 'Verify'}
                </Button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPhase('LOGIN');
                    setChallenge(null);
                    setOtp('');
                    setError(null);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 12,
                    fontWeight: 650,
                    color: '#1a5fb4',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
          </div>

          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: `1px solid ${tokens.colors.border.subtle}`,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>USPIRE ERP v1.0 | {envLabel}</div>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
              © {currentYear} USPIRE Professional Services Limited. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
