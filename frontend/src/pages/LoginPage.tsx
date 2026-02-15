import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { LoginRequires2faResponse, LoginRequiresTenantResponse, LoginResponse } from '../auth/auth.types';
import { DelegationSelectorModal } from '../components/DelegationSelectorModal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { tokens } from '../designTokens';
import { API_BASE_URL } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';

export function LoginPage() {
  const { login, verify2fa, activateDelegation, clearDelegationChoice, state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tenantIdRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const otpRef = useRef<HTMLInputElement | null>(null);

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState<{ tenantId: boolean; email: boolean; password: boolean; otp: boolean }>({
    tenantId: false,
    email: false,
    password: false,
    otp: false,
  });

  const [fieldErrors, setFieldErrors] = useState<{ tenantId?: string; email?: string; password?: string; otp?: string }>({});

  const FORCE_RESET_FLAG_KEY = 'forceResetRequired';
  const FORCE_RESET_EMAIL_KEY = 'forceResetEmail';
  const FORCE_RESET_TENANT_KEY = 'forceResetTenantId';

  function resolveBrandTenantId(): string {
    const tenantId = String(localStorage.getItem('tenantId') ?? '').trim();
    if (tenantId) return tenantId;
    return String(localStorage.getItem('lastTenantId') ?? '').trim() || 'default';
  }

  function resolveLockedMessage(raw: unknown) {
    const text = String(raw ?? '').toLowerCase();
    if (!text) return null;

    if (text.includes('password_locked') || text.includes('account locked') || text.includes('locked')) {
      return 'Your account has been temporarily locked due to multiple failed login attempts. Please try again later or contact your System Administrator.';
    }

    return null;
  }

  const showTenantField = tenantRequired || advancedLogin;

  function validateLogin(next: { tenantId: string; emailOrUsername: string; password: string }) {
    const errs: { tenantId?: string; email?: string; password?: string } = {};
    const email = String(next.emailOrUsername ?? '').trim();

    if (showTenantField && !String(next.tenantId ?? '').trim()) {
      errs.tenantId = 'This field is required';
    }

    if (!email) errs.email = 'This field is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Please enter a valid email address';

    if (!String(next.password ?? '')) errs.password = 'Password is required';
    return errs;
  }

  function validateOtp(nextOtp: string) {
    const errs: { otp?: string } = {};
    const raw = String(nextOtp ?? '').trim();
    if (!raw) errs.otp = 'This field is required';
    else if (!/^\d{6}$/.test(raw)) errs.otp = 'Enter a valid verification code';
    return errs;
  }

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
    setValidationError(null);

    const nextTouched = {
      tenantId: showTenantField,
      email: true,
      password: true,
      otp: false,
    };
    setTouched((prev) => ({ ...prev, ...nextTouched }));

    const errs = validateLogin({ tenantId, emailOrUsername, password });
    setFieldErrors((prev) => ({ ...prev, ...errs }));
    if (Object.keys(errs).length > 0) {
      setValidationError('Please fix the highlighted fields and try again.');
      if (errs.tenantId) tenantIdRef.current?.focus();
      else if (errs.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

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
    setValidationError(null);
    setTouched((prev) => ({ ...prev, email: true }));

    const nextErrors = validateLogin({ tenantId, emailOrUsername, password: password || 'x' });
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

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
    setValidationError(null);

    const nextTouched = { otp: true, tenantId: showTenantField };
    setTouched((prev) => ({ ...prev, ...nextTouched }));

    const tenantErrs = showTenantField && !tenantId.trim() ? { tenantId: 'This field is required' } : {};
    const otpErrs = validateOtp(otp);
    const errs = { ...tenantErrs, ...otpErrs };
    setFieldErrors((prev) => ({ ...prev, ...errs }));
    if (Object.keys(errs).length > 0) {
      setValidationError('Please fix the highlighted fields and try again.');
      if ((errs as any).tenantId) tenantIdRef.current?.focus();
      else otpRef.current?.focus();
      return;
    }

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
    const tid = resolveBrandTenantId();
    if (tid && !localStorage.getItem('lastTenantId')) {
      try {
        localStorage.setItem('lastTenantId', tid);
      } catch {
        // ignore
      }
    }
  }, [location.search]);

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

  const validationBox = validationError ? (
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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Please review the form</div>
      <div>{validationError}</div>
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
    <AuthLayout>
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

      <div style={{ marginTop: 2 }}>
        {phase === 'LOGIN' ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#020445' }}>Sign In</div>
            <form noValidate onSubmit={onSubmitLogin} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {showTenantField ? (
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Organisation</div>
                  <div style={{ marginTop: 6 }}>
                    <Input
                      ref={tenantIdRef}
                      value={tenantId}
                      onChange={(e) => {
                        setTenantId(e.target.value);
                        setValidationError(null);
                        if (touched.tenantId) {
                          setFieldErrors((prev) => ({ ...prev, ...validateLogin({ tenantId: e.target.value, emailOrUsername, password }) }));
                        }
                      }}
                      placeholder="Tenant ID"
                      autoComplete="off"
                      name="tenantId"
                      required={showTenantField}
                      touched={touched.tenantId}
                      error={fieldErrors.tenantId}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 12, color: 'rgba(11,12,30,0.70)', fontWeight: 700 }}>Email</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    ref={emailRef}
                    value={emailOrUsername}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEmailOrUsername(v);
                      setValidationError(null);
                      if (touched.email) {
                        setFieldErrors((prev) => ({ ...prev, ...validateLogin({ tenantId, emailOrUsername: v, password }) }));
                      }
                    }}
                    placeholder="Email"
                    name="email"
                    required
                    touched={touched.email}
                    error={fieldErrors.email}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Password</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPassword(v);
                      setValidationError(null);
                      if (touched.password) {
                        setFieldErrors((prev) => ({ ...prev, ...validateLogin({ tenantId, emailOrUsername, password: v }) }));
                      }
                    }}
                    placeholder="Password"
                    name="password"
                    required
                    touched={touched.password}
                    error={fieldErrors.password}
                    autoComplete="off"
                    style={{ background: 'rgba(2,4,69,0.02)' }}
                    rightAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="p-1 text-slate-500 hover:text-slate-700 focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>
              </div>

              {validationBox}
              {errorBox}

              {successBox}

              <Button
                type="submit"
                disabled={loading}
                variant="accent"
                style={{
                  width: '70%',
                  justifyContent: 'center',
                  alignSelf: 'center',
                  height: 40,
                  borderRadius: 4,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Lock size={16} />
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>

              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => navigate('/forgot-password')}
                  className="auth-link"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Forgot Your Password?
                </button>

                {!tenantRequired ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setAdvancedLogin((v) => !v)}
                    className="auth-link"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Switch Organisation
                  </button>
                ) : null}
              </div>

              {errorCode === 'ACCOUNT_LOCKED' ? (
                <button
                  type="button"
                  disabled={loading || !emailOrUsername.trim()}
                  onClick={handleRequestUnlock}
                  className="auth-link"
                  style={{
                    alignSelf: 'center',
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 750,
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
            </form>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#020445' }}>Verify</div>
            <form noValidate onSubmit={onSubmit2fa} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {showTenantField ? (
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Organisation</div>
                  <div style={{ marginTop: 6 }}>
                    <Input
                      ref={tenantIdRef}
                      value={tenantId}
                      onChange={(e) => {
                        setTenantId(e.target.value);
                        setValidationError(null);
                        if (touched.tenantId) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            ...validateLogin({ tenantId: e.target.value, emailOrUsername, password }),
                          }));
                        }
                      }}
                      placeholder="Tenant ID"
                      autoComplete="off"
                      name="tenantId"
                      required={showTenantField}
                      touched={touched.tenantId}
                      error={fieldErrors.tenantId}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Verification code</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    ref={otpRef}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setValidationError(null);
                      if (touched.otp) {
                        setFieldErrors((prev) => ({ ...prev, ...validateOtp(e.target.value) }));
                      }
                    }}
                    placeholder="One-time code"
                    autoComplete="off"
                    name="otp"
                    required
                    touched={touched.otp}
                    error={fieldErrors.otp}
                    inputMode="numeric"
                  />
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
                  setValidationError(null);
                  setTouched((prev) => ({ ...prev, otp: false }));
                  setFieldErrors((prev) => ({ ...prev, otp: undefined }));
                }}
                className="auth-link"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 12,
                  fontWeight: 650,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: 18, borderTop: '1px solid rgba(11,12,30,0.10)' }}>
        <div style={{ padding: '14px 18px', fontSize: 11.5, color: 'rgba(11,12,30,0.68)', textAlign: 'center', lineHeight: 1.35 }}>
          If you are unable to access your account, please contact your System Administrator at{' '}
          <a href="mailto:support@uspireservices.com" className="auth-link" style={{ fontWeight: 750 }}>
            support@uspireservices.com
          </a>
        </div>
      </div>
</AuthLayout>
);

}
