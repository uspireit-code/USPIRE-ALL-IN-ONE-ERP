import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { tokens } from '../designTokens';
import { getApiErrorMessage, resetPassword } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTimerRef = useRef<number | null>(null);

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const tokenFromQuery = (sp.get('token') ?? '').trim();

    setToken(tokenFromQuery);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  }, [location.key, location.search]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  function isPasswordValid(value: string) {
    if (value.length < 10) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setError('Reset token is required. Please request a new password reset link.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      setError('Password must be at least 10 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(trimmedToken, newPassword, confirmPassword);
      setSuccess('Password reset successful. Redirecting to login...');

      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = window.setTimeout(() => navigate('/login', { replace: true }), 2000);
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
    <AuthLayout>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#020445' }}>Reset Password</div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.55 }}>
        Password must be at least 10 characters and include uppercase, lowercase, number, and special character.
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Reset Token</div>
          <div style={{ marginTop: 6 }}>
            <Input
              className="auth-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste reset token"
              name="resetToken"
              autoComplete="one-time-code"
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
                className="auth-input"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                name="newPassword"
                autoComplete="new-password"
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
                className="auth-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                name="confirmPassword"
                autoComplete="new-password"
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

        <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Resetting…' : 'Reset Password'}
        </Button>

        <Link
          to="/login"
          className="auth-link"
          style={{
            alignSelf: 'center',
            marginTop: 2,
            fontSize: 12,
            fontWeight: 700,
            background: 'transparent',
            padding: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            pointerEvents: loading ? 'none' : 'auto',
            opacity: loading ? 0.65 : 1,
            display: 'inline-block',
          }}
        >
          Back to Sign In
        </Link>
      </form>
    </AuthLayout>
  );
}
