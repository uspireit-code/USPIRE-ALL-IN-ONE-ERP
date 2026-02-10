import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { tokens } from '../designTokens';
import { getApiErrorMessage, requestPasswordReset } from '../services/api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { effective } = useBranding();
  const [logoOk, setLogoOk] = useState(true);

  const [advancedLogin, setAdvancedLogin] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const envLabel = useMemo(() => {
    const mode = String(import.meta.env.MODE ?? '').toLowerCase();
    if (mode === 'production') return 'Production Environment';
    if (mode === 'development') return 'Development Environment';
    return 'Testing Environment';
  }, []);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await requestPasswordReset(email, advancedLogin && tenantId.trim() ? tenantId.trim() : undefined);
      setSuccess('If this account exists, password reset instructions have been sent.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to submit password reset request. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Request could not be completed</div>
      <div>{error}</div>
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

          <div style={{ fontSize: 18, fontWeight: 850, letterSpacing: 0.2 }}>USPIRE Enterprise Resource Planning (ERP)</div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.86)' }}>
            <div>A controlled enterprise system for finance, operations, people, and performance.</div>
            <div>Built for accountability, compliance, and disciplined decision-making.</div>
          </div>
        </div>

        <div style={{ padding: isCompact ? 22 : 28, background: tokens.colors.white }}>
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: tokens.colors.text.primary }}>Forgot password</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
              Enter your email address. If your account exists, we will send password reset instructions.
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {advancedLogin ? (
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                </div>
              </div>

              {errorBox}

              {successBox}

              <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Submitting…' : 'Send Reset Instructions'}
              </Button>

              <button
                type="button"
                disabled={loading}
                onClick={() => navigate('/login')}
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
                Back to Sign In
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => navigate('/reset-password')}
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
                Already have a token? Reset password
              </button>

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
            </form>

            <div
              style={{
                marginTop: 16,
                fontSize: 11.5,
                color: tokens.colors.text.muted,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>{envLabel}</div>
              <div>© {currentYear} USPIRE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
