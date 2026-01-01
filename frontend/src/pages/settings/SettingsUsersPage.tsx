import { useEffect, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { DataTable } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { tokens } from '../../designTokens';
import { useAuth } from '../../auth/AuthContext';
import type { SettingsRole, SettingsUser, SoDConflict } from '../../services/settings';
import { getRoleDisplayInfo } from '../../roleDisplayMap';
import {
  createSettingsUser,
  listSettingsRoles,
  listSettingsUsers,
  updateSettingsUserRoles,
  updateSettingsUserStatus,
  validateSettingsUserRoles,
} from '../../services/settings';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function StatusPill(props: { status: 'ACTIVE' | 'INACTIVE' }) {
  const isActive = props.status === 'ACTIVE';
  const bg = isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)';
  const border = isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.22)';
  const text = isActive ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.85)';

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

export function SettingsUsersPage() {
  const { state } = useAuth();
  const me = state.me?.user;

  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [roles, setRoles] = useState<SettingsRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createdTempPassword, setCreatedTempPassword] = useState<string>('');

  const [assignTarget, setAssignTarget] = useState<null | SettingsUser>(null);
  const [assignRoleIds, setAssignRoleIds] = useState<string[]>([]);
  const [assignConflicts, setAssignConflicts] = useState<SoDConflict[]>([]);
  const [assignValidating, setAssignValidating] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const canActOn = (u: SettingsUser) => {
    return Boolean(me?.id) && u.id !== me?.id;
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([listSettingsUsers(), listSettingsRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const openAssignRoles = (u: SettingsUser) => {
    setAssignTarget(u);
    setAssignRoleIds(u.roles.map((x) => x.id));
    setAssignConflicts([]);
    setSuccess('');
    setError('');
  };

  useEffect(() => {
    if (!assignTarget) return;
    let cancelled = false;
    setAssignValidating(true);
    validateSettingsUserRoles({ roleIds: assignRoleIds })
      .then((res) => {
        if (cancelled) return;
        setAssignConflicts(res.conflicts);
      })
      .catch(() => {
        if (cancelled) return;
        setAssignConflicts([]);
      })
      .finally(() => {
        if (cancelled) return;
        setAssignValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignRoleIds, assignTarget]);

  const onToggleStatus = async (u: SettingsUser) => {
    setSuccess('');
    setError('');
    const next = u.status !== 'ACTIVE';
    const label = next ? 'activate' : 'deactivate';
    const ok = window.confirm(`Are you sure you want to ${label} ${u.email}?`);
    if (!ok) return;
    try {
      const updated = await updateSettingsUserStatus({ id: u.id, isActive: next });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: updated.status } : x)));
      setSuccess('User status updated');
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    }
  };

  const onCreateUser = async () => {
    setCreateSubmitting(true);
    setError('');
    setSuccess('');
    setCreatedTempPassword('');
    try {
      const resp = await createSettingsUser({
        name: createName,
        email: createEmail,
        roleIds: createRoleIds.length > 0 ? createRoleIds : undefined,
      });
      setCreatedTempPassword(resp.temporaryPassword);
      setSuccess('User created');
      setCreateName('');
      setCreateEmail('');
      setCreateRoleIds([]);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to create user');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const onSaveAssignedRoles = async () => {
    if (!assignTarget) return;
    setAssignSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const resp = await updateSettingsUserRoles({ userId: assignTarget.id, roleIds: assignRoleIds });
      setUsers((prev) => prev.map((u) => (u.id === assignTarget.id ? { ...u, roles: resp.roles } : u)));
      setSuccess('Roles updated');
      setAssignTarget(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to update roles');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const assignDisabled = assignSubmitting || assignValidating || assignConflicts.length > 0;

  const groupedRoleOptions = (() => {
    const groups = new Map<string, SettingsRole[]>();
    for (const r of roles) {
      const info = getRoleDisplayInfo(r.name);
      const existing = groups.get(info.category) ?? [];
      existing.push(r);
      groups.set(info.category, existing);
    }

    const order = ['System Administration', 'Finance Operations', 'Planning & Forecasting', 'Audit & Oversight', 'Other'];
    return order
      .filter((k) => groups.has(k))
      .map((k) => {
        const items = (groups.get(k) ?? []).slice().sort((a, b) => {
          const ai = getRoleDisplayInfo(a.name).label;
          const bi = getRoleDisplayInfo(b.name).label;
          return ai.localeCompare(bi);
        });
        return { category: k, items };
      });
  })();

  const conflictingRoleIds = (() => {
    if (assignConflicts.length === 0) return new Set<string>();
    return new Set(assignRoleIds);
  })();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, color: '#0B0C1E' }}>Users</div>
          <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>Manage system users and assign roles.</div>
        </div>
        <Button variant="accent" onClick={() => setShowCreate(true)}>
          Add User
        </Button>
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}
      {success ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="success" title="Success">
            {success}
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 16, padding: 12 }}>
        <DataTable>
          <DataTable.Head>
            <DataTable.Row hoverable={false}>
              <DataTable.Th>Name</DataTable.Th>
              <DataTable.Th>Email</DataTable.Th>
              <DataTable.Th>Roles</DataTable.Th>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Created date</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {users.length === 0 ? (
              <DataTable.Empty colSpan={6} title={loading ? 'Loading…' : 'No users found'} />
            ) : (
              users.map((u, idx) => (
                <DataTable.Row key={u.id} zebra index={idx}>
                  <DataTable.Td>
                    <div style={{ fontWeight: 750 }}>{u.name}</div>
                    {me?.id === u.id ? <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>You</div> : null}
                  </DataTable.Td>
                  <DataTable.Td>{u.email}</DataTable.Td>
                  <DataTable.Td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {u.roles.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'rgba(11,12,30,0.52)' }}>None</span>
                      ) : (
                        u.roles.map((r) => (
                          <span
                            key={r.id}
                            style={{
                              padding: '3px 10px',
                              borderRadius: 999,
                              background: 'rgba(2,4,69,0.06)',
                              border: '1px solid rgba(2,4,69,0.10)',
                              fontSize: 12,
                              fontWeight: 750,
                              color: tokens.colors.navy,
                            }}
                          >
                            {getRoleDisplayInfo(r.name).label}
                          </span>
                        ))
                      )}
                    </div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <StatusPill status={u.status} />
                  </DataTable.Td>
                  <DataTable.Td>{formatDate(u.createdAt)}</DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Button
                        size="sm"
                        variant={u.status === 'ACTIVE' ? 'destructive' : 'secondary'}
                        disabled={!canActOn(u)}
                        title={!canActOn(u) ? 'You cannot change your own status' : undefined}
                        onClick={() => onToggleStatus(u)}
                      >
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" disabled={!canActOn(u)} title={!canActOn(u) ? 'You cannot change your own roles' : undefined} onClick={() => openAssignRoles(u)}>
                        Assign Roles
                      </Button>
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))
            )}
          </DataTable.Body>
        </DataTable>
      </div>

      {showCreate ? (
        <ModalShell
          title="Add User"
          onClose={() => {
            setShowCreate(false);
            setCreatedTempPassword('');
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                variant="accent"
                disabled={createSubmitting || !createName.trim() || !createEmail.trim()}
                onClick={onCreateUser}
                title={!createName.trim() || !createEmail.trim() ? 'Name and email are required' : undefined}
              >
                {createSubmitting ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          }
        >
          {createdTempPassword ? (
            <div style={{ marginBottom: 12 }}>
              <Alert tone="success" title="User created">
                Temporary password: <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{createdTempPassword}</span>
              </Alert>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 6 }}>Name</div>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 6 }}>Email</div>
              <Input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="user@company.com" />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 750, marginBottom: 6 }}>Initial roles (optional)</div>
              {groupedRoleOptions.map((g) => (
                <div key={g.category} style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.navy }}>{g.category}</div>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {g.items.map((r) => {
                      const info = getRoleDisplayInfo(r.name);
                      const checked = createRoleIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid rgba(11,12,30,0.10)',
                            background: checked ? 'rgba(237,186,53,0.12)' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setCreateRoleIds((prev) => {
                                if (next) return Array.from(new Set([...prev, r.id]));
                                return prev.filter((x) => x !== r.id);
                              });
                            }}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: '#0B0C1E' }}>{info.label}</div>
                            <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(11,12,30,0.62)', lineHeight: '16px' }}>{info.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      ) : null}

      {assignTarget ? (
        <ModalShell
          title="Assign Roles"
          subtitle={assignTarget.email}
          onClose={() => setAssignTarget(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setAssignTarget(null)} disabled={assignSubmitting}>
                Cancel
              </Button>
              <Button variant="accent" disabled={assignDisabled} onClick={onSaveAssignedRoles}>
                {assignSubmitting ? 'Saving…' : 'Save Roles'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {groupedRoleOptions.map((g, gIdx) => (
              <div key={g.category}>
                {gIdx > 0 ? <div style={{ height: 1, background: 'rgba(11,12,30,0.06)', margin: '12px 0' }} /> : null}
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.navy }}>{g.category}</div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {g.items.map((r) => {
                    const info = getRoleDisplayInfo(r.name);
                    const checked = assignRoleIds.includes(r.id);
                    const isConflicting = conflictingRoleIds.has(r.id);
                    const bg = checked ? 'rgba(237,186,53,0.12)' : '#fff';
                    const border = isConflicting ? 'rgba(239,68,68,0.45)' : 'rgba(11,12,30,0.10)';
                    return (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${border}`,
                          background: bg,
                          cursor: 'pointer',
                          transition: 'background 120ms ease, border-color 120ms ease',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget;
                          if (!checked) el.style.background = 'rgba(2,4,69,0.03)';
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget;
                          el.style.background = bg;
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setAssignRoleIds((prev) => {
                              if (next) return Array.from(new Set([...prev, r.id]));
                              return prev.filter((x) => x !== r.id);
                            });
                          }}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, color: '#0B0C1E' }}>{info.label}</div>
                          <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(11,12,30,0.62)', lineHeight: '16px' }}>{info.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {assignValidating ? (
              <Alert tone="info" title="Validating roles">
                Checking segregation of duties rules…
              </Alert>
            ) : null}

            {assignConflicts.length > 0 ? (
              <Alert tone="warning" title="Role selection conflict">
                The selected roles conflict with system control rules (segregation of duties). Adjust the selection and try again.
              </Alert>
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
