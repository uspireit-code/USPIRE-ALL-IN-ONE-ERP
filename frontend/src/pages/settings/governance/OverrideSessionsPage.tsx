import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  approveOverrideSession,
  createOverrideSession,
  listOverrideSessions,
  rejectOverrideSession,
  revokeOverrideSession,
  type GovernanceOverrideSessionRow,
  type OverrideSessionStatus,
} from '../../../services/overrideSessions';

type FilterStatus = 'ALL' | OverrideSessionStatus;

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(11,12,30,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'min(86vh, 900px)',
          overflow: 'hidden',
          background: '#fff',
          borderRadius: 18,
          border: '1px solid rgba(11,12,30,0.12)',
          boxShadow: '0 1px 2px rgba(11,12,30,0.06), 0 14px 40px rgba(11,12,30,0.18)',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid rgba(11,12,30,0.08)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
          {props.subtitle ? (
            <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>{props.subtitle}</div>
          ) : null}
        </div>

        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(min(86vh, 900px) - 160px)' }}>{props.children}</div>

        {props.footer ? (
          <div style={{ padding: 16, borderTop: '1px solid rgba(11,12,30,0.08)', background: tokens.colors.surface.subtle }}>{props.footer}</div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeStatus(s: string | null | undefined): OverrideSessionStatus | null {
  const v = String(s ?? '').trim().toUpperCase();
  if (!v) return null;
  if (
    v === 'REQUESTED' ||
    v === 'APPROVED' ||
    v === 'REJECTED' ||
    v === 'EXPIRED' ||
    v === 'EXECUTED' ||
    v === 'REVOKED'
  ) {
    return v as OverrideSessionStatus;
  }
  return null;
}

export function OverrideSessionsPage() {
  const { state, hasPermission } = useAuth();
  const me = state.me?.user;

  const canManage = hasPermission((PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.MANAGE);

  const [rows, setRows] = useState<GovernanceOverrideSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [createOverrideCode, setCreateOverrideCode] = useState('GL_POST_OVERRIDE');
  const [createEntryPoint, setCreateEntryPoint] = useState('GL_JOURNAL_POST_OVERRIDE');
  const [createReason, setCreateReason] = useState('');
  const [createJustification, setCreateJustification] = useState('');
  const [createExpiresAt, setCreateExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const iso = d.toISOString();
    return iso.slice(0, 16);
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return (rows ?? []).filter((r) => normalizeStatus(r.status) === filter);
  }, [filter, rows]);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const list = await listOverrideSessions();
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load override sessions'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    setCreateError(null);
    setSuccess(null);

    const expiresAtIso = new Date(createExpiresAt).toISOString();
    if (!createOverrideCode.trim()) {
      setCreateError('Override code is required.');
      return;
    }
    if (!createEntryPoint.trim()) {
      setCreateError('Entry point is required.');
      return;
    }
    if (createReason.trim().length < 3) {
      setCreateError('Reason must be at least 3 characters.');
      return;
    }
    if (createJustification.trim().length < 3) {
      setCreateError('Justification must be at least 3 characters.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await createOverrideSession({
        overrideCode: createOverrideCode.trim(),
        entryPoint: createEntryPoint.trim(),
        reason: createReason.trim(),
        justification: createJustification.trim(),
        expiresAt: expiresAtIso,
      });
      setSuccess('Override session requested successfully.');
      setCreateOpen(false);
      setCreateReason('');
      setCreateJustification('');
      await refresh();
    } catch (e) {
      setCreateError(getApiErrorMessage(e, 'Override session could not be created.'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const onApprove = async (row: GovernanceOverrideSessionRow) => {
    if (!row?.id) return;
    const ok = window.confirm('Approve override session?');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await approveOverrideSession(row.id);
      setSuccess('Override session approved.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to approve override session'));
    }
  };

  const onReject = async (row: GovernanceOverrideSessionRow) => {
    if (!row?.id) return;
    const ok = window.confirm('Reject override session?');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await rejectOverrideSession(row.id);
      setSuccess('Override session rejected.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to reject override session'));
    }
  };

  const onRevoke = async (row: GovernanceOverrideSessionRow) => {
    if (!row?.id) return;
    const ok = window.confirm('Revoke override session?');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await revokeOverrideSession(row.id);
      setSuccess('Override session revoked.');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to revoke override session'));
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
        + Request Override
      </Button>
      <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Override Sessions"
        subtitle="Request, approve, and manage governed exception sessions (audited)."
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
              { key: 'REQUESTED', label: 'Requested' },
              { key: 'APPROVED', label: 'Approved' },
              { key: 'REJECTED', label: 'Rejected' },
              { key: 'EXECUTED', label: 'Executed' },
              { key: 'REVOKED', label: 'Revoked' },
              { key: 'EXPIRED', label: 'Expired' },
            ] as const
          ).map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant={filter === b.key ? 'accent' : 'secondary'}
              onClick={() => setFilter(b.key as FilterStatus)}
            >
              {b.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card style={{ marginTop: 14, padding: 0 }}>
        <DataTable>
          <DataTable.Head sticky>
            <DataTable.Row>
              <DataTable.Th>Status</DataTable.Th>
              <DataTable.Th>Override Code</DataTable.Th>
              <DataTable.Th>Entry Point</DataTable.Th>
              <DataTable.Th>Reason</DataTable.Th>
              <DataTable.Th>Requested By</DataTable.Th>
              <DataTable.Th>Expires</DataTable.Th>
              <DataTable.Th align="right">Actions</DataTable.Th>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {filteredRows.length === 0 ? (
              <DataTable.Empty colSpan={7} title={loading ? 'Loading…' : 'No override sessions found.'} />
            ) : (
              filteredRows.map((r, idx) => {
                const status = normalizeStatus(r.status) ?? 'REQUESTED';
                const expiresAt = r.expiresAt ? new Date(r.expiresAt) : null;
                const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

                return (
                  <DataTable.Row key={r.id} zebra index={idx}>
                    <DataTable.Td>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{expired && status === 'APPROVED' ? 'EXPIRED' : status}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{r.overrideCode}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontSize: 12 }}>{r.entryPoint}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.reason ?? ''}>
                        {r.reason ?? ''}
                      </div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{r.requestedById === me?.id ? 'You' : r.requestedById}</div>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.expiresAt ? formatDateTime(r.expiresAt) : '—'}</div>
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {canManage && status === 'REQUESTED' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <Button size="sm" variant="accent" onClick={() => onApprove(r)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => onReject(r)}>
                            Reject
                          </Button>
                        </div>
                      ) : canManage && (status === 'APPROVED' || status === 'REQUESTED') ? (
                        <Button size="sm" variant="destructive" onClick={() => onRevoke(r)}>
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
          title="Request Override Session"
          subtitle="Request a governed exception session for a controlled action."
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
                {createSubmitting ? 'Requesting…' : 'Request Override'}
              </Button>
            </div>
          }
        >
          {createError ? (
            <Alert tone="error" title="Could not create override session">
              {createError}
            </Alert>
          ) : null}

          <div style={{ display: 'grid', gap: 14, marginTop: createError ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Override Code</div>
              <div style={{ marginTop: 6 }}>
                <Input value={createOverrideCode} onChange={(e) => setCreateOverrideCode(e.currentTarget.value)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Entry Point</div>
              <div style={{ marginTop: 6 }}>
                <Input value={createEntryPoint} onChange={(e) => setCreateEntryPoint(e.currentTarget.value)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Reason</div>
              <div style={{ marginTop: 6 }}>
                <Input value={createReason} onChange={(e) => setCreateReason(e.currentTarget.value)} placeholder="Why is this exception needed?" />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Justification</div>
              <div style={{ marginTop: 6 }}>
                <Input value={createJustification} onChange={(e) => setCreateJustification(e.currentTarget.value)} placeholder="Explain the justification and supporting context." />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 700 }}>Expires At</div>
              <div style={{ marginTop: 6 }}>
                <Input type="datetime-local" value={createExpiresAt} onChange={(e) => setCreateExpiresAt(e.currentTarget.value)} />
              </div>
            </div>

            <div style={{ fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
              Override sessions are audited and must be approved before use.
            </div>
          </div>
        </ModalShell>
      ) : null}

      {!canManage ? (
        <div style={{ marginTop: 14, fontSize: 12, color: tokens.colors.text.muted }}>
          Note: You do not have financial governance manage permission. You can request sessions, but cannot approve/reject/revoke.
        </div>
      ) : null}
    </div>
  );
}
