import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { resolveBrandAssetUrl, useBranding } from '../branding/BrandingContext';
import { tokens } from '../designTokens';
import { changeExpiredPassword, getApiErrorMessage } from '../services/api';

const FORCE_RESET_FLAG_KEY = 'forceResetRequired';
const FORCE_RESET_EMAIL_KEY = 'forceResetEmail';

export function ForcePasswordResetPage() {
  const navigate = useNavigate();
  const { effective } = useBranding();
  const [logoOk, setLogoOk] = useState(true);

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

  function resolveSafeErrorMessage(err: unknown) {
    const raw = String(getApiErrorMessage(err, '') ?? '').trim();
    const lowered = raw.toLowerCase();

    if (lowered.includes('prisma') || lowered.includes('c:\\') || lowered.includes('stack')) {
      return 'Password update could not be completed. Please contact your System Administrator.';
    }

    const allowList = new Set([
      'Passwords do not match',
      'Email is required',
      'New password is required',
      'Tenant resolution required',
      'Invalid user',
      'Password reset is not required',
    ]);

    if (allowList.has(raw)) return raw;
    if (lowered.includes('password') && raw.length <= 180) return raw;

    return 'Password update could not be completed. Please contact your System Administrator.';
  }

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 920);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const ok = sessionStorage.getItem(FORCE_RESET_FLAG_KEY) === 'true';
    if (!ok) {
      navigate('/login?reason=unauthorized', { replace: true });
    }
  }, [navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const emailOrUsername = (sessionStorage.getItem(FORCE_RESET_EMAIL_KEY) ?? '').trim();
    const tenantId = (sessionStorage.getItem('forceResetTenantId') ?? '').trim();

    if (!emailOrUsername) {
      setError('Reset session is missing. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      await changeExpiredPassword({
        emailOrUsername,
        tenantId: tenantId || undefined,
        newPassword,
        confirmPassword,
      });

      sessionStorage.removeItem(FORCE_RESET_FLAG_KEY);
      sessionStorage.removeItem(FORCE_RESET_EMAIL_KEY);
      sessionStorage.removeItem('forceResetTenantId');

      setSuccess('Password updated successfully. Redirecting to login...');
      window.setTimeout(() => navigate('/login?reason=password_reset_success', { replace: true }), 2500);
    } catch (err) {
      setError(resolveSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const cardMaxWidth = 640;

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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Password update could not be completed</div>
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
            <div>Built for accountability, compliance, and disciplined decision-making.</div>
          </div>
        </div>

        <div style={{ padding: isCompact ? 22 : 28, background: tokens.colors.white }}>
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: tokens.colors.text.primary }}>Password Reset Required</div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
              Your password must be updated before you can access the system.
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
              Password must be at least 10 characters and include uppercase, lowercase, number, and special character.
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
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

              <Button type="submit" disabled={loading || Boolean(success)} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
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
