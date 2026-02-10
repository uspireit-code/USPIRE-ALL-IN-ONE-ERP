import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  createDelegation,
  listAdminUsers,
  listDelegations,
  revokeDelegation,
  type AdminUserLookup,
  type DelegationRow,
  type DelegationScope,
} from '../../../services/delegations';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function toDatetimeLocalValue(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDatetimeLocalValue(value: string) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function computeStatus(d: { revokedAt: string | null; expiresAt: string }) {
  if (d.revokedAt) return 'REVOKED' as const;
  const exp = new Date(d.expiresAt);
  if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return 'EXPIRED' as const;
  return 'ACTIVE' as const;
}

function StatusBadge(props: { status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' }) {
  const status = props.status;
  const bg = status === 'ACTIVE' ? 'rgba(16,185,129,0.12)' : status === 'EXPIRED' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.10)';
  const border = status === 'ACTIVE' ? 'rgba(16,185,129,0.25)' : status === 'EXPIRED' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.22)';
  const text = status === 'ACTIVE' ? 'rgba(16,185,129,0.95)' : status === 'EXPIRED' ? 'rgba(146,64,14,0.95)' : 'rgba(239,68,68,0.85)';

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
        whiteSpace: 'nowrap',
      }}
    >
      {status}
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
        zIndex: 60,
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 620,
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

        <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>

        {props.footer ? (
          <div style={{ padding: 16, borderTop: '1px solid rgba(11,12,30,0.08)', boxShadow: '0 -8px 20px rgba(11,12,30,0.06)', background: '#fff' }}>
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function validateCreate(params: {
  delegatorUserId: string;
  delegateUserId: string;
  startsAtIso: string;
  expiresAtIso: string;
}) {
  if (!params.delegatorUserId) return 'Delegator is required.';
  if (!params.delegateUserId) return 'Delegate is required.';
  if (params.delegatorUserId === params.delegateUserId) return 'Delegator and delegate must be different users.';

  const s = new Date(params.startsAtIso);
  const e = new Date(params.expiresAtIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Start and expiry times are required.';
  if (e.getTime() <= s.getTime()) return 'Expiry must be after start time.';

  const maxMs = 90 * 24 * 60 * 60 * 1000;
  if (e.getTime() - s.getTime() > maxMs) return 'Duration cannot exceed 90 days.';

  return null;
}

export function DelegationsPage() {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'>('ALL');
  const [rows, setRows] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<AdminUserLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDelegatorUserId, setCreateDelegatorUserId] = useState('');
  const [createDelegateUserId, setCreateDelegateUserId] = useState('');
  const [createScope, setCreateScope] = useState<DelegationScope>('BOTH');
  const [createStartsAt, setCreateStartsAt] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [createExpiresAt, setCreateExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return toDatetimeLocalValue(d.toISOString());
  });
  const [createReason, setCreateReason] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const userById = useMemo(() => new Map((users ?? []).map((u) => [u.id, u] as const)), [users]);

  const filteredRows = useMemo(() => {
    const enriched = (rows ?? []).map((r) => ({ ...r, status: computeStatus(r) }));
    if (filter === 'ALL') return enriched;
    return enriched.filter((r) => r.status === filter);
  }, [filter, rows]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [u, d] = await Promise.all([listAdminUsers(), listDelegations({ includeExpired: true })]);
      setUsers(u.users ?? []);
      setRows(d.delegations ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load delegations'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConfirmRevoke = async (row: DelegationRow) => {
    if (!row?.id) return;
    const ok = window.confirm('Revoke delegation?');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await revokeDelegation(row.id);
      setSuccess('Delegation revoked successfully.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to revoke delegation'));
    }
  };

  const onCreate = async () => {
    setCreateError(null);
    setSuccess(null);

    const startsAtIso = fromDatetimeLocalValue(createStartsAt);
    const expiresAtIso = fromDatetimeLocalValue(createExpiresAt);

    const validation = validateCreate({
      delegatorUserId: createDelegatorUserId,
      delegateUserId: createDelegateUserId,
      startsAtIso,
      expiresAtIso,
    });
    if (validation) {
      setCreateError(validation);
      return;
    }

    setCreateSubmitting(true);
    try {
      await createDelegation({
        delegatorUserId: createDelegatorUserId,
        delegateUserId: createDelegateUserId,
        scope: createScope,
        startsAt: startsAtIso,
        expiresAt: expiresAtIso,
        reason: createReason.trim() ? createReason.trim() : undefined,
      });
      setSuccess('Delegation created successfully.');
      setCreateOpen(false);
      setCreateReason('');
      await refresh();
    } catch (e) {
      setCreateError(getApiErrorMessage(e, 'Delegation could not be created. Please contact your System Administrator.'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const toolbar = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        variant="secondary"
        onClick={() => {
          setSuccess(null);
          setError(null);
          setCreateError(null);
          setCreateOpen(true);
        }}
      >
        + Create Delegation
      </Button>
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Delegations"
        subtitle="Manage delegated authority assignments (audited)."
        rightSlot={toolbar}
      />

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert tone="success" title="Success">
            {success}
          </Alert>
        ) : null}
      </div>

      <Card style={{ marginTop: 14, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Filter</div>
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'ACTIVE', label: 'Active' },
              { key: 'EXPIRED', label: 'Expired' },
              { key: 'REVOKED', label: 'Revoked' },
            ] as const
          ).map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant={filter === b.key ? 'accent' : 'secondary'}
              onClick={() => setFilter(b.key)}
            >
              {b.label}
            </Button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 14, padding: 0 }}>
        <DataTable>
          <DataTable.Head sticky>
            <DataTable.Row>
              <DataTable.Th>Delegator</DataTable.Th>
              <DataTable.Th>Delegate</DataTable.Th>
              <DataTable.Th>Scope</DataTable.Th>
              <DataTable.Th>Start</DataTable.Th>
              <DataTable.Th>Expiry</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Reason</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {filteredRows.length === 0 ? (
              <DataTable.Empty colSpan={8} title="No delegations found." />
            ) : (
              filteredRows.map((r, idx) => {
                const status = computeStatus(r);
                const delegator = userById.get(r.delegatorUserId);
                const delegate = userById.get(r.delegateUserId);
                return (
                  <DataTable.Row key={r.id} zebra index={idx}>
                    <DataTable.Td>
                      <div style={{ fontWeight: 650 }}>{delegator?.fullName ?? '—'}</div>
                      <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{delegator?.email ?? r.delegatorUserId}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontWeight: 650 }}>{delegate?.fullName ?? '—'}</div>
                      <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{delegate?.email ?? r.delegateUserId}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <span style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{r.scope}</span>
                    </DataTable.Td>
                    <DataTable.Td>
                      <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(r.startsAt)}</span>
                    </DataTable.Td>
                    <DataTable.Td>
                      <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(r.expiresAt)}</span>
                    </DataTable.Td>
                    <DataTable.Td>
                      <StatusBadge status={status} />
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.reason ?? ''}>
                        {r.reason ?? ''}
                      </div>
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {status === 'ACTIVE' ? (
                        <Button size="sm" variant="destructive" onClick={() => onConfirmRevoke(r)}>
                          Revoke
                        </Button>
                      ) : (
                        <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>—</span>
                      )}
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })
            )}
          </DataTable.Body>
        </DataTable>
      </Card>

      {createOpen ? (
        <ModalShell
          title="Create Delegation"
          subtitle="Create a tenant-scoped delegation assignment (audited)."
          onClose={() => {
            if (createSubmitting) return;
            setCreateOpen(false);
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="secondary"
                disabled={createSubmitting}
                onClick={() => {
                  setCreateOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="accent" disabled={createSubmitting} onClick={onCreate}>
                {createSubmitting ? 'Creating…' : 'Create Delegation'}
              </Button>
            </div>
          }
        >
          {createError ? (
            <Alert tone="error" title="Could not create delegation">
              {createError}
            </Alert>
          ) : null}

          <div style={{ display: 'grid', gap: 14, marginTop: createError ? 12 : 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Delegator</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={createDelegatorUserId}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateDelegatorUserId(e.currentTarget.value);
                    }}
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 12px',
                      borderRadius: tokens.radius.sm,
                      border: `1px solid ${tokens.colors.border.default}`,
                      background: tokens.colors.white,
                      color: tokens.colors.text.primary,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Select delegator…</option>
                    {(users ?? [])
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Delegate</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={createDelegateUserId}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateDelegateUserId(e.currentTarget.value);
                    }}
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 12px',
                      borderRadius: tokens.radius.sm,
                      border: `1px solid ${tokens.colors.border.default}`,
                      background: tokens.colors.white,
                      color: tokens.colors.text.primary,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Select delegate…</option>
                    {(users ?? [])
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Scope</div>
                <div style={{ marginTop: 6 }}>
                  <select
                    value={createScope}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateScope(e.currentTarget.value as DelegationScope);
                    }}
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 12px',
                      borderRadius: tokens.radius.sm,
                      border: `1px solid ${tokens.colors.border.default}`,
                      background: tokens.colors.white,
                      color: tokens.colors.text.primary,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="APPROVE">APPROVE</option>
                    <option value="POST">POST</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Reason</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    value={createReason}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateReason(e.currentTarget.value);
                    }}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Starts At</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    type="datetime-local"
                    value={createStartsAt}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateStartsAt(e.currentTarget.value);
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Expires At</div>
                <div style={{ marginTop: 6 }}>
                  <Input
                    type="datetime-local"
                    value={createExpiresAt}
                    onChange={(e) => {
                      setCreateError(null);
                      setCreateExpiresAt(e.currentTarget.value);
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
              Duration must not exceed 90 days. Delegation actions are fully audited.
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
