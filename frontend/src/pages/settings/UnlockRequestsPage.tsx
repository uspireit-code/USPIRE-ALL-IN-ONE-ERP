import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { tokens } from '../../designTokens';
import type { UnlockRequestRow } from '../../services/settings';
import { listUnlockRequests, resolveUnlockRequest, unlockUserFromRequest } from '../../services/settings';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function StatusPill(props: { status: 'PENDING' | 'RESOLVED' }) {
  const isPending = props.status === 'PENDING';
  const bg = isPending ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.12)';
  const border = isPending ? 'rgba(245,158,11,0.30)' : 'rgba(16,185,129,0.25)';
  const text = isPending ? 'rgba(146,64,14,0.95)' : 'rgba(16,185,129,0.95)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 750,
        color: text,
      }}
    >
      {props.status}
    </span>
  );
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,12,30,0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 560,
          maxWidth: '96vw',
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(11,12,30,0.08)',
          boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid rgba(11,12,30,0.08)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
            {props.subtitle ? <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{props.subtitle}</div> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>
        <div
          style={{
            padding: 16,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {props.children}
        </div>

        {props.footer ? (
          <div
            style={{
              padding: 16,
              borderTop: '1px solid rgba(11,12,30,0.08)',
              boxShadow: '0 -8px 20px rgba(11,12,30,0.06)',
              background: '#fff',
            }}
          >
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UnlockRequestsPage() {
  const { state } = useAuth();
  const me = state.me?.user;

  const isAdmin = useMemo(() => {
    const roles = (me?.roles ?? []).map((r) => String(r ?? '').toUpperCase());
    return roles.some((r) => ['SUPER_ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN', 'SYSTEMADMIN'].includes(r));
  }, [me?.roles]);

  const [rows, setRows] = useState<UnlockRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [unlockTarget, setUnlockTarget] = useState<UnlockRequestRow | null>(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listUnlockRequests();
      setRows(res.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load unlock requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onMarkResolved = async (r: UnlockRequestRow) => {
    setError('');
    setSuccess('');
    try {
      await resolveUnlockRequest(r.id);
      setSuccess('Request marked as resolved.');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve unlock request.');
    }
  };

  const onConfirmUnlock = async () => {
    if (!unlockTarget) return;
    setUnlockSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await unlockUserFromRequest(unlockTarget.id);
      setSuccess('User unlocked successfully');
      setUnlockTarget(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to unlock user.');
    } finally {
      setUnlockSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <SettingsPageHeader
          title="Unlock Requests"
          subtitle="Review locked-account unlock requests for this tenant."
        />
        <div style={{ marginTop: 16, background: '#fff', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>You do not have permission to view this page.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="Unlock Requests"
        subtitle="Review locked-account unlock requests for this tenant."
        rightSlot={
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <div style={{ marginTop: 14, border: '1px solid rgba(183, 28, 28, 0.35)', background: 'rgba(183, 28, 28, 0.06)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, color: 'rgba(183, 28, 28, 0.92)' }}>Action failed</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.primary }}>{error}</div>
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 14, border: '1px solid rgba(46, 125, 50, 0.28)', background: 'rgba(46, 125, 50, 0.06)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, color: 'rgba(46, 125, 50, 0.92)' }}>Success</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.primary }}>{success}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 16, padding: 12 }}>
        <DataTable>
          <DataTable.Head>
            <DataTable.Row hoverable={false}>
              <DataTable.Th>User Email</DataTable.Th>
              <DataTable.Th>Requested At</DataTable.Th>
              <DataTable.Th>IP Address</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Resolved At</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {rows.length === 0 ? (
              <DataTable.Empty colSpan={6} title={loading ? 'Loading…' : 'No unlock requests found'} />
            ) : (
              rows.map((r, idx) => {
                const isPending = r.status === 'PENDING';
                return (
                  <DataTable.Row key={r.id} zebra index={idx}>
                    <DataTable.Td>
                      <div style={{ fontWeight: 750 }}>{r.userEmail}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>{r.id}</div>
                    </DataTable.Td>
                    <DataTable.Td>{formatDateTime(r.requestedAt)}</DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontSize: 13 }}>{r.ipAddress || '—'}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <StatusPill status={r.status} />
                    </DataTable.Td>
                    <DataTable.Td>{r.resolvedAt ? formatDateTime(r.resolvedAt) : '—'}</DataTable.Td>
                    <DataTable.Td align="right">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={!isPending}
                          onClick={() => {
                            setUnlockTarget(r);
                            setError('');
                            setSuccess('');
                          }}
                          style={{ justifyContent: 'center' }}
                        >
                          Unlock User
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!isPending}
                          onClick={() => onMarkResolved(r)}
                        >
                          Mark Resolved
                        </Button>
                      </div>
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })
            )}
          </DataTable.Body>
        </DataTable>
      </div>

      {unlockTarget ? (
        <ModalShell
          title="Unlock User"
          subtitle={unlockTarget.userEmail}
          onClose={() => {
            if (unlockSubmitting) return;
            setUnlockTarget(null);
          }}
          width={520}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" disabled={unlockSubmitting} onClick={() => setUnlockTarget(null)}>
                Cancel
              </Button>
              <Button variant="accent" disabled={unlockSubmitting} onClick={onConfirmUnlock}>
                {unlockSubmitting ? 'Unlocking…' : 'Unlock User'}
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.72)', lineHeight: '18px' }}>
            Confirm unlocking this user account. This will resolve the unlock request automatically.
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
