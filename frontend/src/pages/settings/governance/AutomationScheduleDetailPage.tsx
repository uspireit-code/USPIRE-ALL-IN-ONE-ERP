import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
  executeAutomationSchedule,
  getAutomationSchedule,
  resumeAutomationSchedule,
  revokeAutomationSchedule,
  suspendAutomationSchedule,
  type GovernanceAutomationScheduleRow,
} from '../../../services/automationSchedules';
import { listAutomationExecutions, type GovernanceAutomationExecutionRow } from '../../../services/automationExecutions';

function safeUpper(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

function formatDateTime(value: string | null | undefined) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function AutomationScheduleDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const scheduleId = String(id ?? '').trim();

  const { hasPermission } = useAuth();
  const canManage = hasPermission((PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.MANAGE);

  const [row, setRow] = useState<GovernanceAutomationScheduleRow | null>(null);
  const [executions, setExecutions] = useState<GovernanceAutomationExecutionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [manualRunAt, setManualRunAt] = useState(() => {
    const d = new Date();
    const iso = d.toISOString();
    return iso.slice(0, 16);
  });
  const [manualGovernanceReason, setManualGovernanceReason] = useState('Manual supervised schedule execution');

  async function refresh() {
    if (!scheduleId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [s, ex] = await Promise.all([
        getAutomationSchedule(scheduleId),
        listAutomationExecutions({ scheduleId }),
      ]);
      setRow(s ?? null);
      setExecutions(Array.isArray(ex) ? ex : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load schedule'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const status = useMemo(() => safeUpper((row as any)?.scheduleStatus), [row]);
  const isSuspended = status === 'SUSPENDED';
  const isRevoked = status === 'REVOKED';
  const isExpired = status === 'EXPIRED';

  async function onSuspend() {
    if (!row?.id) return;
    const reason = window.prompt('Suspension reason (audited):', row.lastFailureReason ?? '');
    if (reason === null) return;

    setError(null);
    setSuccess(null);
    try {
      await suspendAutomationSchedule(row.id, { reason: reason.trim() || undefined });
      setSuccess('Schedule suspended.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to suspend schedule'));
    }
  }

  async function onResume() {
    if (!row?.id) return;
    const ok = window.confirm('Resume schedule? This clears failure counters and unsuspends the schedule.');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await resumeAutomationSchedule(row.id);
      setSuccess('Schedule resumed.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to resume schedule'));
    }
  }

  async function onRevoke() {
    if (!row?.id) return;
    const reason = window.prompt('Revocation reason (audited):', '');
    if (reason === null) return;

    const ok = window.confirm('Revoke schedule? This is irreversible and prevents future execution.');
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await revokeAutomationSchedule(row.id, { reason: reason.trim() || undefined });
      setSuccess('Schedule revoked.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to revoke schedule'));
    }
  }

  async function onExecuteNow() {
    if (!row?.id) return;

    const runAtIso = new Date(manualRunAt).toISOString();
    const ok = window.confirm(
      `Execute schedule now?\n\nThis is a supervised action and will create an execution session with governance enforcement.\n\nRunAt (UTC): ${runAtIso}`,
    );
    if (!ok) return;

    setError(null);
    setSuccess(null);
    try {
      await executeAutomationSchedule(row.id, {
        runAt: runAtIso,
        governanceReason: manualGovernanceReason.trim() || undefined,
      });
      setSuccess('Execution requested.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to execute schedule'));
    }
  }

  const actions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button size="sm" variant="ghost" onClick={() => navigate('/settings/governance/automation')}>
        Back
      </Button>
      <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
      {canManage ? (
        <>
          {!isRevoked && !isExpired && !isSuspended ? (
            <Button size="sm" variant="destructive" onClick={onSuspend}>
              Suspend
            </Button>
          ) : null}
          {!isRevoked && !isExpired && isSuspended ? (
            <Button size="sm" variant="accent" onClick={onResume}>
              Resume
            </Button>
          ) : null}
          {!isRevoked ? (
            <Button size="sm" variant="destructive" onClick={onRevoke}>
              Revoke
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Automation Schedule"
        subtitle="A lifecycle-governed automation schedule. Inspect status, failure governance, expiry, and supervised execution history."
        rightSlot={actions}
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

      {!row ? (
        <div style={{ marginTop: 14 }}>
          <Card title={loading ? 'Loading…' : 'Schedule not found'} subtitle="">
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              {loading ? 'Loading schedule…' : 'No data available.'}
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
          <div style={{ gridColumn: 'span 12' }}>
            <Card title="Lifecycle State" subtitle="Governance lifecycle state and execution timing.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Status</div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900 }}>{status || '—'}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Automation</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>{row.automationCode}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Next Run</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{formatDateTime(row.nextRunAt)}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Last Run</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{formatDateTime(row.lastRunAt)}</div>
                </div>

                <div style={{ gridColumn: 'span 6' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Target</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    {row.targetType}:{' '}
                    <span style={{ color: tokens.colors.text.muted }}>{row.targetId}</span>
                  </div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Expires</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{formatDateTime(row.expiresAt)}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Failure Count</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 900 }}>{String(row.consecutiveFailureCount ?? 0)}</span>
                    {row.lastFailureReason ? (
                      <span style={{ color: tokens.colors.text.muted }}> — {String(row.lastFailureReason)}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Schedule Config (governed)</div>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    background: tokens.colors.surface.subtle,
                    overflowX: 'auto',
                    fontSize: 12,
                    lineHeight: '18px',
                  }}
                >
                  {JSON.stringify((row as any).scheduleConfig ?? null, null, 2)}
                </pre>
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Card
              title="Supervised Manual Execution"
              subtitle="Manual execution triggers the orchestrator with governance enforcement. This does not bypass policy or audit." 
              actions={
                canManage && !isRevoked && !isExpired ? (
                  <Button size="sm" variant="accent" onClick={onExecuteNow}>
                    Execute
                  </Button>
                ) : undefined
              }
            >
              {!canManage ? (
                <Alert tone="warning" title="Manage permission required">
                  Manual execution requires {(PERMISSIONS as any).GOVERNANCE?.FINANCIAL?.MANAGE}.
                </Alert>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, marginTop: 12 }}>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Run At (UTC)</div>
                  <div style={{ marginTop: 6 }}>
                    <Input type="datetime-local" value={manualRunAt} onChange={(e) => setManualRunAt(e.currentTarget.value)} />
                  </div>
                </div>
                <div style={{ gridColumn: 'span 8' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Governance Reason</div>
                  <div style={{ marginTop: 6 }}>
                    <Input value={manualGovernanceReason} onChange={(e) => setManualGovernanceReason(e.currentTarget.value)} />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Card
              title="Execution History"
              subtitle="Execution sessions for this schedule. Drill down for governance metadata, evidence/override linkage, escalation and results." 
            >
              <DataTable>
                <DataTable.Head sticky>
                  <DataTable.Row>
                    <DataTable.Th>Status</DataTable.Th>
                    <DataTable.Th>Started</DataTable.Th>
                    <DataTable.Th>Completed</DataTable.Th>
                    <DataTable.Th>Override</DataTable.Th>
                    <DataTable.Th>Failure</DataTable.Th>
                    <DataTable.Th align="right">Inspect</DataTable.Th>
                  </DataTable.Row>
                </DataTable.Head>
                <DataTable.Body>
                  {(executions ?? []).length === 0 ? (
                    <DataTable.Empty colSpan={6} title={loading ? 'Loading…' : 'No execution sessions for this schedule.'} />
                  ) : (
                    (executions ?? []).map((ex, idx) => (
                      <DataTable.Row key={ex.id} zebra index={idx}>
                        <DataTable.Td>
                          <div style={{ fontWeight: 900, fontSize: 12 }}>{safeUpper((ex as any).executionStatus)}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime((ex as any).startedAt)}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime((ex as any).completedAt)}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, color: (ex as any).overrideSessionId ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                            {(ex as any).overrideSessionId ? String((ex as any).overrideSessionId) : '—'}
                          </div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div
                            style={{
                              fontSize: 12,
                              maxWidth: 340,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: (ex as any).failureReason ? tokens.colors.text.primary : tokens.colors.text.muted,
                            }}
                            title={String((ex as any).failureReason ?? '')}
                          >
                            {(ex as any).failureReason ? String((ex as any).failureReason) : '—'}
                          </div>
                        </DataTable.Td>
                        <DataTable.Td align="right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/settings/governance/automation/executions/${ex.id}`)}
                          >
                            Inspect
                          </Button>
                        </DataTable.Td>
                      </DataTable.Row>
                    ))
                  )}
                </DataTable.Body>
              </DataTable>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
