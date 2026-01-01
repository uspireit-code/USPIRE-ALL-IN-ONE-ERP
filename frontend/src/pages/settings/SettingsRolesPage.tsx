import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { tokens } from '../../designTokens';
import type { SettingsRoleDetails, SettingsRoleOverview } from '../../services/settings';
import { getSettingsRoleDetails, listSettingsRolesOverview } from '../../services/settings';

function Badge(props: { label: string; tone: 'neutral' | 'info' | 'warning' }) {
  const bg =
    props.tone === 'warning'
      ? 'rgba(237,186,53,0.18)'
      : props.tone === 'info'
        ? 'rgba(2,4,69,0.08)'
        : 'rgba(11,12,30,0.06)';
  const fg = props.tone === 'warning' ? '#6C4A00' : '#0B0C1E';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 650,
        background: bg,
        color: fg,
        border: '1px solid rgba(11,12,30,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {props.label}
    </span>
  );
}

function CheckIcon(props: { allowed: boolean }) {
  const color = props.allowed ? tokens.colors.text.primary : 'rgba(11,12,30,0.28)';
  return (
    <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color }} aria-hidden>
      {props.allowed ? '✔' : '✖'}
    </span>
  );
}

export function SettingsRolesPage() {
  const [roles, setRoles] = useState<SettingsRoleOverview[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [details, setDetails] = useState<SettingsRoleDetails | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  const selectedRole = useMemo(() => roles.find((r) => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);

  const refresh = async () => {
    setLoadingList(true);
    setError('');
    try {
      const resp = await listSettingsRolesOverview();
      setRoles(resp);
      if (!selectedRoleId && resp.length > 0) setSelectedRoleId(resp[0].id);
    } catch (e: any) {
      setError(e?.message || 'Failed to load roles');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingDetails(true);
      setError('');
      try {
        const resp = await getSettingsRoleDetails(selectedRoleId);
        if (!cancelled) setDetails(resp);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load role details');
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 750, color: '#0B0C1E' }}>Roles & Permissions</div>
          <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px', maxWidth: 760 }}>
            Roles define what users can do in the system. Permissions are grouped and controlled to enforce accountability and segregation of duties.
          </div>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loadingList}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ background: '#fff', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(11,12,30,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 750, color: '#0B0C1E' }}>Roles</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.58)', lineHeight: '16px' }}>Click a role to see what it can do.</div>
          </div>

          <div style={{ padding: 8 }}>
            {loadingList ? (
              <div style={{ padding: 12, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>Loading roles…</div>
            ) : roles.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>No roles found.</div>
            ) : (
              roles.map((r) => {
                const active = r.id === selectedRoleId;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 12,
                      padding: 12,
                      border: active ? '1px solid rgba(2,4,69,0.26)' : '1px solid rgba(11,12,30,0.06)',
                      background: active ? 'rgba(2,4,69,0.04)' : '#fff',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 750, color: '#0B0C1E' }}>{r.name}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.58)', lineHeight: '16px' }}>{r.description || '—'}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {r.badges.admin ? <Badge label="Admin" tone="warning" /> : null}
                      {r.badges.canApprove ? <Badge label="Can approve" tone="info" /> : null}
                      {r.badges.readOnly ? <Badge label="Read-only" tone="neutral" /> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid rgba(11,12,30,0.08)', borderRadius: 16, padding: 16 }}>
          {!selectedRoleId ? (
            <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>Select a role to view details.</div>
          ) : loadingDetails || !details ? (
            <div style={{ fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>Loading role details…</div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0B0C1E' }}>{details.name}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(11,12,30,0.62)', lineHeight: '18px' }}>{details.description || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {selectedRole?.badges?.admin ? <Badge label="Admin" tone="warning" /> : null}
                  {selectedRole?.badges?.canApprove ? <Badge label="Can approve" tone="info" /> : null}
                  {selectedRole?.badges?.readOnly ? <Badge label="Read-only" tone="neutral" /> : null}
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(11,12,30,0.02)', border: '1px solid rgba(11,12,30,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: '#0B0C1E' }}>Role Overview</div>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
                  <div style={{ color: 'rgba(11,12,30,0.62)' }}>Role name</div>
                  <div style={{ color: '#0B0C1E', fontWeight: 650 }}>{details.name}</div>

                  <div style={{ color: 'rgba(11,12,30,0.62)' }}>Description</div>
                  <div style={{ color: '#0B0C1E' }}>{details.description || '—'}</div>

                  <div style={{ color: 'rgba(11,12,30,0.62)' }}>Intended users</div>
                  <div style={{ color: '#0B0C1E' }}>{details.intendedUsers || '—'}</div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: '#0B0C1E' }}>Permissions Breakdown (read-only)</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.58)', lineHeight: '16px' }}>
                  Permissions are shown for understanding only. Changes are controlled and will be introduced in a later step.
                </div>

                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  {details.permissions.map((group) => (
                    <div key={group.module} style={{ border: '1px solid rgba(11,12,30,0.06)', borderRadius: 14, padding: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 750, color: '#0B0C1E' }}>{group.module}</div>
                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        {group.items.map((p) => (
                          <div key={`${group.module}-${p.label}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <CheckIcon allowed={p.allowed} />
                            <div>
                              <div style={{ fontSize: 13, color: '#0B0C1E', fontWeight: 650 }}>{p.label}</div>
                              <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(11,12,30,0.58)', lineHeight: '16px' }}>{p.explanation}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: '#0B0C1E' }}>Control Rules</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(11,12,30,0.58)', lineHeight: '16px' }}>
                  These rules exist to prevent a single person from creating and approving the same work, and to protect sensitive controls.
                </div>

                {details.controlRules.length === 0 ? (
                  <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(11,12,30,0.62)' }}>No specific control rules apply to this role.</div>
                ) : (
                  <div style={{ marginTop: 10, border: '1px solid rgba(11,12,30,0.06)', borderRadius: 14, padding: 12 }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {details.controlRules.slice(0, 8).map((r) => (
                        <div key={r} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span aria-hidden style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: 'rgba(11,12,30,0.5)' }}>
                            •
                          </span>
                          <div style={{ fontSize: 13, color: '#0B0C1E', lineHeight: '18px' }}>{r}</div>
                        </div>
                      ))}
                    </div>
                    {details.controlRules.length > 8 ? (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(11,12,30,0.58)' }}>
                        Showing the first 8 rules.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
