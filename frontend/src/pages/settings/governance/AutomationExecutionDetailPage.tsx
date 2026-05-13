import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { getAutomationExecution, type GovernanceAutomationExecutionRow } from '../../../services/automationExecutions';

function formatDateTime(value: string | null | undefined) {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function safeUpper(value: any) {
  return String(value ?? '').trim().toUpperCase();
}

export function AutomationExecutionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const executionId = String(id ?? '').trim();

  const [row, setRow] = useState<GovernanceAutomationExecutionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!executionId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getAutomationExecution(executionId);
      setRow(r ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load execution session'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  const severity = useMemo(() => {
    const meta = (row as any)?.governanceMetadata;
    const sev = meta?.governance?.after?.policy?.severity ?? meta?.governance?.policy?.severity ?? meta?.policy?.severity;
    return String(sev ?? '—').trim() || '—';
  }, [row]);

  const domain = useMemo(() => {
    const meta = (row as any)?.governanceMetadata;
    const d = meta?.governance?.governanceDomain ?? meta?.governance?.domain ?? meta?.domain;
    return String(d ?? '—').trim() || '—';
  }, [row]);

  const status = useMemo(() => safeUpper((row as any)?.executionStatus), [row]);

  const headerActions = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Button size="sm" variant="ghost" onClick={() => navigate('/settings/governance/automation')}>
        Back
      </Button>
      <Button size="sm" variant="secondary" onClick={refresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
      {row?.scheduleId ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/settings/governance/automation/schedules/${row.scheduleId}`)}
        >
          View Schedule
        </Button>
      ) : null}
    </div>
  );

  return (
    <div>
      <SettingsPageHeader
        title="Automation Execution"
        subtitle="Execution session visibility: timeline, governance metadata, evidence/override linkage, escalation, failures, and outcomes."
        rightSlot={headerActions}
      />

      <div style={{ marginTop: 14 }}>
        {error ? (
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        ) : null}
      </div>

      {!row ? (
        <div style={{ marginTop: 14 }}>
          <Card title={loading ? 'Loading…' : 'Execution not found'} subtitle="">
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              {loading ? 'Loading execution…' : 'No data available.'}
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
          <div style={{ gridColumn: 'span 12' }}>
            <Card title="Execution Timeline" subtitle="When the execution started, completed, and how it ended.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Status</div>
                  <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900 }}>{status || '—'}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Severity</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>{severity}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Governance Domain</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{domain}</div>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Automation</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>{row.automationCode}</div>
                </div>

                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Started</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{formatDateTime((row as any).startedAt)}</div>
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Completed</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{formatDateTime((row as any).completedAt)}</div>
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Schedule</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: row.scheduleId ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                    {row.scheduleId ? String(row.scheduleId) : '—'}
                  </div>
                </div>

                <div style={{ gridColumn: 'span 12' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Failure / Outcome</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: row.failureReason ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                    {row.failureReason ? String(row.failureReason) : '—'}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Card title="Override / Evidence / Escalation" subtitle="Visibility into governed exception mechanisms.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Override Session</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: row.overrideSessionId ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                    {row.overrideSessionId ? String(row.overrideSessionId) : '—'}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Escalation</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: row.escalationType || row.escalationReason ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                    {row.escalationType || row.escalationReason
                      ? `${String(row.escalationType ?? '')}${row.escalationReason ? ` — ${String(row.escalationReason)}` : ''}`
                      : '—'}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Retry Count</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{String((row as any).retryCount ?? 0)}</div>
                </div>

                <div style={{ gridColumn: 'span 12' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Evidence Metadata</div>
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
                    {JSON.stringify((row as any).evidenceMetadata ?? null, null, 2)}
                  </pre>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Card title="Governance Metadata" subtitle="The exact governance metadata captured for this execution (audit-defensible).">
              <pre
                style={{
                  marginTop: 0,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: tokens.colors.surface.subtle,
                  overflowX: 'auto',
                  fontSize: 12,
                  lineHeight: '18px',
                }}
              >
                {JSON.stringify((row as any).governanceMetadata ?? null, null, 2)}
              </pre>
            </Card>
          </div>

          <div style={{ gridColumn: 'span 12' }}>
            <Card title="Execution Result" subtitle="Result payload produced by the orchestrator.">
              <pre
                style={{
                  marginTop: 0,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  background: tokens.colors.surface.subtle,
                  overflowX: 'auto',
                  fontSize: 12,
                  lineHeight: '18px',
                }}
              >
                {JSON.stringify((row as any).executionResult ?? null, null, 2)}
              </pre>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
