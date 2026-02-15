import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { tokens } from '../designTokens';
import { getApiErrorMessage, requestPasswordReset } from '../services/api';
import { AuthLayout } from '../components/AuthLayout';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const redirectTimerRef = useRef<number | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState<{ email: boolean }>({ email: false });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  function validate(nextEmail: string) {
    const e = String(nextEmail ?? '').trim();
    const next: { email?: string } = {};
    if (!e) next.email = 'This field is required';
    else if (!/^\S+@\S+\.\S+$/.test(e)) next.email = 'Please enter a valid email address';
    return next;
  }

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setValidationError(null);
    setSuccess(null);

    const nextTouched = { email: true };
    setTouched(nextTouched);
    const nextErrors = validate(email);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setValidationError('Please fix the highlighted fields and try again.');
      emailRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess('If this account exists, password reset instructions have been sent.');

      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = window.setTimeout(() => navigate('/reset-password', { replace: true }), 1800);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to submit password reset request. Please try again.'));
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
      <div style={{ fontWeight: 750, marginBottom: 4, color: 'rgba(183, 28, 28, 0.92)' }}>Request could not be completed</div>
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
      <div style={{ fontSize: 20, fontWeight: 900, color: '#020445' }}>Forgot Password</div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: tokens.colors.text.secondary, lineHeight: 1.45 }}>
        Enter the email address associated with your account. We'll send you instructions to reset your password.
      </div>

      <form noValidate onSubmit={onSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Email</div>
          <div style={{ marginTop: 6 }}>
            <Input
              ref={emailRef}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidationError(null);
                if (touched.email) {
                  setFieldErrors(validate(e.target.value));
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

        {validationBox}

        {errorBox}

        {successBox}

        <Button type="submit" disabled={loading} variant="accent" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Submitting…' : 'Send reset instructions'}
        </Button>

        <div>
          <Link
            to="/login"
            className="auth-link"
            style={{
              fontSize: 12,
              fontWeight: 650,
              background: 'transparent',
              padding: 0,
              display: 'inline-block',
              cursor: loading ? 'not-allowed' : 'pointer',
              pointerEvents: loading ? 'none' : 'auto',
              opacity: loading ? 0.65 : 1,
            }}
          >
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
