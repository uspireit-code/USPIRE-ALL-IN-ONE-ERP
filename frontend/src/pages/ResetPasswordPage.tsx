import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { tokens } from '../designTokens';
import { getApiErrorMessage, resetPassword } from '../services/api';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { effective } = useBranding();
  const [logoOk, setLogoOk] = useState(true);

  const sp = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tokenFromQuery = (sp.get('token') ?? '').trim();

  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    if (!tokenFromQuery) return;
    setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (token) return;
    setError('Reset token is required. Please request a new password reset link.');
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Reset token is required. Please request a new password reset link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword, confirmPassword);
      setSuccess('Password reset successful. Redirecting to login...');
      window.setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const status = (err as any)?.status;
      if (status === 400) {
        const msg = String((err as any)?.body?.message ?? (err as any)?.body?.error ?? '').toLowerCase();
        if (msg.includes('token') || msg.includes('expired') || msg.includes('invalid')) {
          setError('Reset token is invalid or expired.');
        } else {
          setError(getApiErrorMessage(err, 'Unable to reset password. Please try again.'));
        }
      } else {
        setError(getApiErrorMessage(err, 'Unable to reset password. Please try again.'));
      }
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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Password reset could not be completed</div>
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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(46, 125, 50, 0.92)' }}>Success</div>
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
            <div style={{ fontSize: 14, fontWeight: 800, color: tokens.colors.text.primary }}>Reset password</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
              Password must be at least 10 characters and include uppercase, lowercase, number, and special character.
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Reset Token</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste reset token"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>New Password</div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New Password"
                      autoComplete="off"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
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
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Confirm Password</div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      autoComplete="off"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {errorBox}

              {successBox}

              <Button type="submit" disabled={loading || !token || token.length < 8 || newPassword !== confirmPassword} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Resetting…' : 'Reset Password'}
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
            </form>

            <div
              style={{
                marginTop: 18,
                fontSize: 12,
                color: tokens.colors.text.muted,
                textAlign: 'center',
              }}
            >
              {envLabel} • © {currentYear} USPIRE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
