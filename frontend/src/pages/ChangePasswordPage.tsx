import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/PageHeader';
import { tokens } from '../designTokens';
import { getApiErrorMessage } from '../services/api';
import { changeMyPassword } from '../services/users';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validation = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (!newPassword) errs.newPassword = 'New password is required';
    if (newPassword && newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    if (!confirmNewPassword) errs.confirmNewPassword = 'Please confirm your new password';
    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
      errs.confirmNewPassword = 'Passwords do not match';
    }
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errs.newPassword = 'New password must be different from current password';
    }
    return errs;
  }, [confirmNewPassword, currentPassword, newPassword]);

  async function onSubmit() {
    setError(null);
    setSuccess(null);
    setTouched({ currentPassword: true, newPassword: true, confirmNewPassword: true });

    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword, confirmNewPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess('Password changed successfully');
      window.setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to change password'));
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving;

  return (
    <div style={{ display: 'grid', gap: tokens.spacing.x3 }}>
      <PageHeader title="Change Password" description="Update your password to keep your account secure." />

      {error ? <Alert tone="error" title={error} /> : null}
      {success ? <Alert tone="success" title={success} /> : null}

      <Card title="Password" subtitle="Use a strong password you don't reuse elsewhere.">
        <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>Current Password</div>
            <Input
              name="currentPassword"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              touched={Boolean(touched.currentPassword)}
              error={validation.currentPassword}
              disabled={disabled}
              autoComplete="current-password"
              rightAdornment={
                <button type="button" onClick={() => setShowCurrent((s) => !s)} aria-label={showCurrent ? 'Hide password' : 'Show password'}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>New Password</div>
            <Input
              name="newPassword"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              touched={Boolean(touched.newPassword)}
              error={validation.newPassword}
              disabled={disabled}
              autoComplete="new-password"
              rightAdornment={
                <button type="button" onClick={() => setShowNew((s) => !s)} aria-label={showNew ? 'Hide password' : 'Show password'}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>Confirm New Password</div>
            <Input
              name="confirmNewPassword"
              type={showConfirm ? 'text' : 'password'}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              touched={Boolean(touched.confirmNewPassword)}
              error={validation.confirmNewPassword}
              disabled={disabled}
              autoComplete="new-password"
              rightAdornment={
                <button type="button" onClick={() => setShowConfirm((s) => !s)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Button variant="primary" disabled={disabled} onClick={onSubmit}>
              Change Password
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                setError(null);
                setSuccess(null);
                setTouched({});
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
