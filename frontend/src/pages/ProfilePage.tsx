import { useMemo, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PageHeader } from '../components/PageHeader';
import { getApiErrorMessage } from '../services/api';
import { updateMyProfile, uploadMyAvatar } from '../services/users';
import { tokens } from '../designTokens';

export function ProfilePage() {
  const { state, refreshMe } = useAuth();

  const me = state.me;
  const user = me?.user;
  const tenant = me?.tenant;

  const fullName = String(user?.name ?? '').trim();
  const email = String(user?.email ?? '').trim();
  const phone = String(user?.phone ?? '').trim();

  const [firstName, setFirstName] = useState(() => {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts[0] ?? '';
  });
  const [lastName, setLastName] = useState(() => {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.slice(1).join(' ');
  });
  const [phoneNumber, setPhoneNumber] = useState(phone);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const username = useMemo(() => {
    if (!email) return '—';
    const local = email.split('@')[0] ?? '';
    return local || email;
  }, [email]);

  const roleLabel = useMemo(() => {
    const role = Array.isArray(user?.roles) ? user?.roles[0] : '';
    if (!role) return '—';
    return String(role)
      .split('_')
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }, [user?.roles]);

  const createdAt = '—';
  const accountStatus = state.isAuthenticated ? 'Active' : '—';

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    return errs;
  }

  async function onSave() {
    setError(null);
    setSuccess(null);

    const errs = validate();
    setTouched({ firstName: true, lastName: true, phoneNumber: true });
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload: { fullName: string; phone?: string } = {
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      };
      const nextPhone = phoneNumber.trim();
      if (nextPhone) payload.phone = nextPhone;

      await updateMyProfile(payload);
      await refreshMe();
      setSuccess('Profile updated successfully');
      window.setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await uploadMyAvatar(file);
      await refreshMe();
      setSuccess('Profile picture updated');
      window.setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to upload avatar'));
    } finally {
      setSaving(false);
    }
  }

  const errs = validate();

  return (
    <div style={{ display: 'grid', gap: tokens.spacing.x3 }}>
      <PageHeader
        title="Profile"
        description="Manage your account information and identity."
        actions={
          <Button variant="primary" disabled={saving} onClick={onSave}>
            Save Changes
          </Button>
        }
      />

      {error ? <Alert tone="error" title={error} /> : null}
      {success ? <Alert tone="success" title={success} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: tokens.spacing.x3 }}>
        <Card title="Personal Information" subtitle="Update your name and contact details.">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>First Name</div>
              <Input
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                touched={Boolean(touched.firstName)}
                error={errs.firstName}
                disabled={saving}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>Last Name</div>
              <Input
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                touched={Boolean(touched.lastName)}
                error={errs.lastName}
                disabled={saving}
              />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.secondary }}>Phone Number</div>
              <Input
                name="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                touched={Boolean(touched.phoneNumber)}
                error={undefined}
                disabled={saving}
                placeholder="e.g. +260 97 000 0000"
              />
            </div>
          </div>
        </Card>

        <Card title="Account" subtitle="Your identity in this tenant.">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: tokens.colors.surface.subtle,
                  border: `1px solid ${tokens.colors.border.default}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {user?.avatarUrl ? (
                  <img src={String(user.avatarUrl)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontWeight: 800, color: tokens.colors.text.secondary }}>
                    {`${(firstName.trim()[0] ?? '').toUpperCase()}${(lastName.trim()[0] ?? '').toUpperCase()}` || 'U'}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 750, color: tokens.colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName || email || '—'}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: tokens.colors.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email || '—'}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera size={16} />
                    Change Photo
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => onAvatarSelected(e.currentTarget.files?.[0] ?? null)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <InfoRow label="Role" value={roleLabel} />
              <InfoRow label="Tenant" value={tenant?.name ?? '—'} />
              <InfoRow label="Username" value={username} />
              <InfoRow label="Account Status" value={accountStatus} />
              <InfoRow label="Created" value={createdAt} />
              <InfoRow label="User ID" value={user?.id ?? '—'} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <div style={{ width: 120, fontSize: 12, fontWeight: 750, color: 'rgba(11,12,30,0.62)' }}>{props.label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#0B0C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {props.value}
      </div>
    </div>
  );
}
