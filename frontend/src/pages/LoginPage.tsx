import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Alert } from '../components/Alert';
import { tokens } from '../designTokens';
import { useBrandColors, useBranding } from '../branding/BrandingContext';

export function LoginPage() {
  const { login, state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const brand = useBrandColors();
  const { effective } = useBranding();

  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId') ?? state.tenantId ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    try {
      await login({ tenantId: tenantId.trim() ? tenantId.trim() : undefined, email, password });
      const sp = new URLSearchParams(location.search);
      const next = sp.get('next');
      navigate(next && next.startsWith('/') ? next : '/', { replace: true });
    } catch (err: any) {
      const msg = err?.body?.message ?? err?.body?.error ?? 'Login failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const reason = (sp.get('reason') ?? '').trim().toLowerCase();
    if (!reason) return;

    if (reason === 'unauthorized') {
      setError('Your session has expired. Please sign in again.');
    } else if (reason === 'forbidden') {
      setError('Access denied. Please sign in with an account that has permission.');
    } else if (reason === 'session') {
      setError('Session could not load. Please sign in again.');
    }
  }, [location.search]);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const spinner = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }} aria-hidden>
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <style>{`@keyframes usspireSpin{to{transform:rotate(360deg)}}`}</style>
      <g style={{ transformOrigin: '12px 12px', animation: 'uspireSpin 0.9s linear infinite' }} />
    </svg>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isCompact ? 16 : 28,
        background: 'rgba(11,12,30,0.02)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: tokens.shadow.card,
          transform: 'translateY(0px)',
          transition: `transform ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}`,
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr',
          background: tokens.colors.white,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = tokens.shadow.cardHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0px)';
          e.currentTarget.style.boxShadow = tokens.shadow.card;
        }}
      >
        <div
          style={{
            background: brand.navy,
            color: tokens.colors.white,
            padding: isCompact ? 24 : 36,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: 0.2 }}>
                {effective?.organisationName || 'USPiRE Enterprise Resource Planning (ERP)'}
              </div>
              <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7, color: 'rgba(252,252,252,0.84)' }}>
                “USPIRE ERP is an integrated enterprise platform designed to help organisations manage finance, operations, people, and performance within a single, controlled system. It provides secure access, structured workflows, and reliable information to support accountability, compliance, and informed decision-making across the organisation.”
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            © 2025 USPiRE Professional Services Limited. All rights reserved.
          </div>
        </div>

        <div style={{ padding: isCompact ? 24 : 36, background: tokens.colors.white }}>
          <div style={{ fontSize: 18, fontWeight: 750, color: tokens.colors.text.primary }}>Sign in</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>Enter your credentials to continue. Tenant is optional if your user belongs to only one tenant.</div>

          <form onSubmit={onSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Tenant ID (optional)</div>
              <div style={{ marginTop: 6 }}>
                <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Leave blank if not required" />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Email / Username</div>
              <div style={{ marginTop: 6 }}>
                <Input
                  name="email"
                  placeholder="Enter email or username"
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
                    name="password"
                    placeholder="Enter password"
                    autoComplete="off"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 10,
                      transform: 'translateY(-50%)',
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: '1px solid transparent',
                      background: 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      color: tokens.colors.text.secondary,
                      cursor: 'pointer',
                      transition: `background ${tokens.transition.fast}, color ${tokens.transition.fast}, border-color ${tokens.transition.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = tokens.colors.surface.subtle;
                      e.currentTarget.style.borderColor = tokens.colors.border.subtle;
                      e.currentTarget.style.color = tokens.colors.text.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.color = tokens.colors.text.secondary;
                    }}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 10.6a3 3 0 0 0 4.24 4.24"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9.88 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-5.06 5.56"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6.1 6.1C3.6 8.1 2 12 2 12s3.5 7 10 7c1.02 0 1.98-.17 2.87-.46"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <Alert tone="error" title="Login failed">
                {error}
              </Alert>
            ) : null}

            <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {loading ? spinner : null}
                {loading ? 'Signing in…' : 'Sign in'}
              </span>
            </Button>

            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{ fontSize: 12, color: tokens.colors.text.secondary, textDecoration: 'none', fontWeight: 650 }}
              >
                Forgot password?
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
