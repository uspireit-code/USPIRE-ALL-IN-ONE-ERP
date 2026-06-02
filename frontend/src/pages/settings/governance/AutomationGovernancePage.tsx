import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { EmptyState } from '../../../components/EmptyState';
import { Input } from '../../../components/Input';
import { NoticeCard } from '../../../components/NoticeCard';
import { AutomationIndicators } from '../../../components/governance/AutomationIndicators';
import { AutomationSeverityBadge } from '../../../components/governance/AutomationSeverityBadge';
import { SettingsPageHeader } from '../../../components/settings/SettingsPageHeader';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  listAutomationSchedules,
  sweepDueAutomationSchedules,
  previewAutomationSchedule,
  createAutomationSchedule,
  type GovernanceAutomationScheduleRow,
} from '../../../services/automationSchedules';
import { listApprovedRecurringTemplates, type RecurringJournalTemplate } from '../../../services/glRecurring';
import { listJournalBrowser, type JournalBrowserRow } from '../../../services/gl';
import {
  listAutomationExecutions,
  type GovernanceAutomationExecutionRow,
} from '../../../services/automationExecutions';

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

function getExecutionSeverity(row: GovernanceAutomationExecutionRow): string {
  const meta = (row as any)?.governanceMetadata;
  const sev = meta?.governance?.after?.policy?.severity ?? meta?.governance?.policy?.severity ?? meta?.policy?.severity;
  return String(sev ?? '—').trim() || '—';
}

function hasEvidence(row: GovernanceAutomationExecutionRow): boolean {
  const ev = (row as any)?.evidenceMetadata;
  if (Array.isArray(ev)) return ev.length > 0;
  if (Array.isArray(ev?.refs)) return ev.refs.length > 0;
  return Boolean(ev);
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable?.[0];
      (first ?? root).focus?.();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const root = panelRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      }
    };

    focusFirst();
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [props]);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
          <div style={{ padding: 16, borderTop: '1px solid rgba(11,12,30,0.08)' }}>{props.footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AutomationGovernancePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission((PERMISSIONS as any).GOVERNANCE?.AUTOMATION?.CREATE);
  const canExecute = hasPermission((PERMISSIONS as any).GOVERNANCE?.AUTOMATION?.EXECUTE);

  const [schedules, setSchedules] = useState<GovernanceAutomationScheduleRow[]>([]);
  const [executions, setExecutions] = useState<GovernanceAutomationExecutionRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sweepNow, setSweepNow] = useState(() => {
    const d = new Date();
    const iso = d.toISOString();
    return iso.slice(0, 16);
  });
  const [sweepLimit, setSweepLimit] = useState('50');
  const [sweepIncludeSuspended, setSweepIncludeSuspended] = useState(false);
  const [sweepExecute, setSweepExecute] = useState(false);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepResult, setSweepResult] = useState<any | null>(null);
  const [sweepConfirm, setSweepConfirm] = useState<null | { nowIso: string; limit: number }>(null);

  const [createAutomationCode, setCreateAutomationCode] = useState(
    'RECURRING_JOURNAL_AUTOMATION',
  );

  const [recurringTemplates, setRecurringTemplates] = useState<RecurringJournalTemplate[]>([]);
  const [recurringTemplateQuery, setRecurringTemplateQuery] = useState('');
  const [journalQuery, setJournalQuery] = useState('');
  const [journalResults, setJournalResults] = useState<JournalBrowserRow[]>([]);
  const [journalSearchLoading, setJournalSearchLoading] = useState(false);

  const [createTargetId, setCreateTargetId] = useState('');

  const [scheduleFrequency, setScheduleFrequency] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>(
    'MONTHLY',
  );
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [scheduleMonthUtc, setScheduleMonthUtc] = useState('0');
  const [scheduleTimeUtc, setScheduleTimeUtc] = useState('02:00');
  const [useExplicitNextRunAt, setUseExplicitNextRunAt] = useState(false);

  const [governanceAutoSubmitForReview, setGovernanceAutoSubmitForReview] = useState(true);
  const [governanceRequireEvidence, setGovernanceRequireEvidence] = useState(false);
  const [governanceActivationStatus, setGovernanceActivationStatus] = useState<'ACTIVE' | 'DRAFT' | 'SUSPENDED'>(
    'ACTIVE',
  );
  const [moreComplianceOpen, setMoreComplianceOpen] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedTargetTypeOverride, setAdvancedTargetTypeOverride] = useState('');
  const [advancedScheduleConfigJson, setAdvancedScheduleConfigJson] = useState('');
  const [createNextRunAt, setCreateNextRunAt] = useState('');
  const [createExpiresAt, setCreateExpiresAt] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ now: string; count: number; warnings: string[]; nextRuns: string[] } | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const automationDefinition = useMemo(() => {
    const code = String(createAutomationCode ?? '').trim();
    if (code === 'RECURRING_JOURNAL_AUTOMATION') {
      return {
        code,
        label: 'Recurring Journal',
        description: 'Create journals from a recurring template on a governed cadence.',
        targetType: 'RECURRING_TEMPLATE',
        targetLabel: 'Recurring template',
        supportsScheduleConfig: true,
      } as const;
    }
    if (code === 'REVERSAL_AUTOMATION') {
      return {
        code,
        label: 'Scheduled Reversal',
        description: 'Schedule a governed reversal for a journal entry.',
        targetType: 'JOURNAL_ENTRY',
        targetLabel: 'Journal entry',
        supportsScheduleConfig: false,
      } as const;
    }
    if (code === 'ACCRUAL_AUTOMATION') {
      return {
        code,
        label: 'Accrual Automation',
        description: 'Schedule an accrual workflow (configuration may vary by tenant policy).',
        targetType: '',
        targetLabel: 'Target',
        supportsScheduleConfig: false,
      } as const;
    }
    if (code === 'ALLOCATION_AUTOMATION') {
      return {
        code,
        label: 'Allocation Automation',
        description: 'Schedule governed allocations (configuration may vary by tenant policy).',
        targetType: '',
        targetLabel: 'Target',
        supportsScheduleConfig: false,
      } as const;
    }

    return {
      code,
      label: 'Automation',
      description: 'Select an automation type.',
      targetType: '',
      targetLabel: 'Target',
      supportsScheduleConfig: false,
    } as const;
  }, [createAutomationCode]);

  const derivedTargetType = useMemo(() => {
    const override = String(advancedTargetTypeOverride ?? '').trim();
    if (override) return override;
    return automationDefinition.targetType;
  }, [advancedTargetTypeOverride, automationDefinition.targetType]);

  const computedScheduleConfig = useMemo(() => {
    const governanceMeta = {
      governance: {
        autoSubmitForReview: Boolean(governanceAutoSubmitForReview),
        requireEvidence: Boolean(governanceRequireEvidence),
        activationStatus: governanceActivationStatus,
      },
    };

    const automationCode = String(automationDefinition.code ?? '').trim();
    if (automationCode === 'RECURRING_JOURNAL_AUTOMATION' && !useExplicitNextRunAt) {
      const [hh, mm] = String(scheduleTimeUtc || '02:00')
        .split(':')
        .map((x) => Number(x));
      const hourUtc = Number.isFinite(hh) ? hh : 2;
      const minuteUtc = Number.isFinite(mm) ? mm : 0;
      const base = {
        frequency: scheduleFrequency,
        dayOfMonth: Number(scheduleDayOfMonth || 1),
        hourUtc,
        minuteUtc,
        ...(scheduleFrequency === 'YEARLY' ? { monthUtc: Number(scheduleMonthUtc || 0) } : {}),
      };
      return { ...base, ...governanceMeta };
    }

    if (!advancedOpen) {
      return Object.keys(governanceMeta).length > 0 ? governanceMeta : null;
    }

    const raw = String(advancedScheduleConfigJson ?? '').trim();
    if (!raw) return Object.keys(governanceMeta).length > 0 ? governanceMeta : null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return governanceMeta;
      return { ...(parsed as any), ...governanceMeta };
    } catch {
      return { __invalidJson: true, raw, ...governanceMeta } as any;
    }
  }, [
    advancedOpen,
    advancedScheduleConfigJson,
    automationDefinition.code,
    governanceActivationStatus,
    governanceAutoSubmitForReview,
    governanceRequireEvidence,
    scheduleDayOfMonth,
    scheduleFrequency,
    scheduleMonthUtc,
    scheduleTimeUtc,
    useExplicitNextRunAt,
  ]);

  const selectedRecurringTemplate = useMemo(() => {
    const id = String(createTargetId ?? '').trim();
    if (!id) return null;
    return (recurringTemplates ?? []).find((t) => String(t.id) === id) ?? null;
  }, [createTargetId, recurringTemplates]);

  const isTargetSelected = Boolean(String(derivedTargetType ?? '').trim() && String(createTargetId ?? '').trim());
  const canRunPreviewCreate = canCreate && isTargetSelected && !(computedScheduleConfig as any)?.__invalidJson;

  async function refresh() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [s, e] = await Promise.all([
        listAutomationSchedules(),
        listAutomationExecutions(),
      ]);

      setSchedules(Array.isArray(s) ? s : []);
      setExecutions(Array.isArray(e) ? e : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load automation governance data'));
    } finally {
      setLoading(false);
    }

  }

  async function refreshCreateLookups() {
    try {
      const t = await listApprovedRecurringTemplates();
      setRecurringTemplates(Array.isArray(t) ? t : []);
    } catch {
      setRecurringTemplates([]);
    }
  }

  async function searchJournals() {
    const q = String(journalQuery ?? '').trim();
    if (!q) {
      setJournalResults([]);
      return;
    }
    if (journalSearchLoading) return;
    setJournalSearchLoading(true);
    try {
      const res = await listJournalBrowser({ limit: 25, offset: 0 } as any);
      const items = Array.isArray((res as any)?.items) ? ((res as any).items as JournalBrowserRow[]) : [];
      const filtered = items.filter((r) => {
        const id = String((r as any).id ?? '').toLowerCase();
        const ref = String((r as any).reference ?? '').toLowerCase();
        const desc = String((r as any).description ?? '').toLowerCase();
        const s = q.toLowerCase();
        return id.includes(s) || ref.includes(s) || desc.includes(s);
      });
      setJournalResults(filtered.slice(0, 25));
    } catch {
      setJournalResults([]);
    } finally {
      setJournalSearchLoading(false);
    }
  }

  async function runPreview() {
    if (previewLoading) return;
    setError(null);
    setSuccess(null);
    setPreviewResult(null);

    const automationCode = String(createAutomationCode ?? '').trim();
    const targetType = String(derivedTargetType ?? '').trim();
    const targetId = String(createTargetId ?? '').trim();
    if (!automationCode || !targetType || !targetId) {
      setError('Select an automation type and a target to run preview.');
      return;
    }

    const scheduleConfig = computedScheduleConfig;
    if ((scheduleConfig as any)?.__invalidJson) {
      setError('Advanced Technical Configuration must be valid JSON.');
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await previewAutomationSchedule({
        automationCode,
        targetType,
        targetId,
        scheduleConfig,
        nextRunAt: createNextRunAt ? new Date(createNextRunAt).toISOString() : undefined,
        expiresAt: createExpiresAt ? new Date(createExpiresAt).toISOString() : undefined,
        count: 5,
      });
      setPreviewResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Preview failed'));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveSchedule() {
    if (createSaving) return;
    setError(null);
    setSuccess(null);

    const automationCode = String(createAutomationCode ?? '').trim();
    const targetType = String(derivedTargetType ?? '').trim();
    const targetId = String(createTargetId ?? '').trim();
    if (!automationCode || !targetType || !targetId) {
      setError('Select an automation type and a target before creating a schedule.');
      return;
    }

    const scheduleConfig = computedScheduleConfig;
    if ((scheduleConfig as any)?.__invalidJson) {
      setError('Advanced Technical Configuration must be valid JSON.');
      return;
    }

    setCreateSaving(true);
    try {
      await createAutomationSchedule({
        automationCode,
        targetType,
        targetId,
        scheduleConfig,
        nextRunAt: createNextRunAt ? new Date(createNextRunAt).toISOString() : undefined,
        expiresAt: createExpiresAt ? new Date(createExpiresAt).toISOString() : undefined,
      });
      setSuccess('Schedule created.');
      setPreviewResult(null);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create schedule'));
    } finally {
      setCreateSaving(false);
    }
  }

  useEffect(() => {
    void refresh();
    void refreshCreateLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of schedules ?? []) {
      const st = safeUpper((s as any).scheduleStatus);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [schedules]);

  const executionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ex of executions ?? []) {
      const st = safeUpper((ex as any).executionStatus);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [executions]);

  const recentExecutions = useMemo(() => {
    const rows = [...(executions ?? [])];
    rows.sort((a, b) => {
      const at = new Date(String((a as any).startedAt ?? 0)).getTime();
      const bt = new Date(String((b as any).startedAt ?? 0)).getTime();
      return bt - at;
    });
    return rows.slice(0, 25);
  }, [executions]);

  const suspendedSchedules = useMemo(() => {
    return (schedules ?? []).filter((s) => safeUpper((s as any).scheduleStatus) === 'SUSPENDED').length;
  }, [schedules]);

  const reviewRequiredSchedules = useMemo(() => {
    return (schedules ?? []).filter((s) => safeUpper((s as any).scheduleStatus) === 'REVIEW_REQUIRED').length;
  }, [schedules]);

  const failedSchedules = useMemo(() => {
    return (schedules ?? []).filter((s) => safeUpper((s as any).scheduleStatus) === 'FAILED').length;
  }, [schedules]);

  const expiredSchedules = useMemo(() => {
    return (schedules ?? []).filter((s) => safeUpper((s as any).scheduleStatus) === 'EXPIRED').length;
  }, [schedules]);

  const overrideLinkedExecutions = useMemo(() => {
    return (executions ?? []).filter((x) => Boolean((x as any).overrideSessionId)).length;
  }, [executions]);

  const evidenceLinkedExecutions = useMemo(() => {
    return (executions ?? []).filter((x) => hasEvidence(x)).length;
  }, [executions]);

  const escalatedExecutions = useMemo(() => {
    return (executions ?? []).filter((x) => Boolean((x as any).escalationType) || Boolean((x as any).escalationReason)).length;
  }, [executions]);

  const toolbar = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  );

  async function executeSweep(params: { nowIso: string; limit: number }) {
    if (sweepRunning) return;
    setError(null);
    setSuccess(null);
    setSweepResult(null);

    setSweepRunning(true);
    try {
      const res = await sweepDueAutomationSchedules({
        now: params.nowIso,
        limit: params.limit,
        includeSuspended: sweepIncludeSuspended,
        execute: sweepExecute,
        governanceReason: 'Supervised sweep (Automation Governance UI)',
      });

      setSweepResult(res);
      setSuccess(sweepExecute ? 'Sweep executed.' : 'Sweep dry-run completed.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sweep failed'));
    } finally {
      setSweepRunning(false);
    }
  }

  async function runSweep() {
    if (sweepRunning) return;

    const nowIso = new Date(sweepNow).toISOString();
    const limit = Math.max(1, Math.min(200, Math.floor(Number(sweepLimit || '50'))));

    if (sweepExecute) {
      setSweepConfirm({ nowIso, limit });
      return;
    }

    await executeSweep({ nowIso, limit });
  }

  return (
    <div>
      <SettingsPageHeader
        title="Automation Governance"
        subtitle="Governance-transparent automation operations. Schedules and executions are lifecycle entities: reviewable, auditable, suspension-aware, override-aware, evidence-aware, and supervised."
        rightSlot={toolbar}
      />

      <div style={{ marginTop: 14 }}>
        {error ? (
          <NoticeCard kind="system" title="Unable to load automation governance">
            {error}
          </NoticeCard>
        ) : null}
        {success ? (
          <NoticeCard kind="success" title="Completed">
            {success}
          </NoticeCard>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14, marginTop: 14 }}>
        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Operational Overview"
            subtitle="Live visibility into governed automation states. No background execution occurs from this UI without explicit confirmation."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
              <div style={{ gridColumn: 'span 3', padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 800 }}>Schedules</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{(schedules ?? []).length}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>
                  Suspended: {suspendedSchedules} | Failed: {failedSchedules}
                </div>
              </div>
              <div style={{ gridColumn: 'span 3', padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 800 }}>Executions</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{(executions ?? []).length}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>
                  Override-linked: {overrideLinkedExecutions}
                </div>
              </div>
              <div style={{ gridColumn: 'span 3', padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 800 }}>Pending Review</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{reviewRequiredSchedules}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>Schedules requiring review</div>
              </div>
              <div style={{ gridColumn: 'span 3', padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 800 }}>Escalations / Evidence</div>
                <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                  Escalated executions: {escalatedExecutions}
                  <br />
                  Evidence-linked: {evidenceLinkedExecutions}
                  <br />
                  Expired schedules: {expiredSchedules}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.keys(scheduleCounts)
                .sort()
                .map((k) => (
                  <span key={k} style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                    <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{k}</span> {scheduleCounts[k]}
                  </span>
                ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.keys(executionCounts)
                .sort()
                .map((k) => (
                  <span key={k} style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                    <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{k}</span> {executionCounts[k]}
                  </span>
                ))}
            </div>
          </Card>
        </div>

        <div id="automation-create-schedule" style={{ gridColumn: 'span 12' }}>
          <Card
            title="Activate Automation"
            subtitle="Set up a recurring accounting automation in about 60 seconds."
            actions={
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button variant="secondary" size="sm" onClick={runPreview} disabled={!canRunPreviewCreate || previewLoading}>
                  {previewLoading ? 'Reviewing…' : 'Review'}
                </Button>
                <Button variant="accent" size="sm" onClick={saveSchedule} disabled={!canRunPreviewCreate || createSaving}>
                  {createSaving ? 'Activating…' : 'Activate automation'}
                </Button>
              </div>
            }
          >
            {!canCreate ? (
              <NoticeCard kind="permission" title="Create permission required">
                Schedule creation requires {(PERMISSIONS as any).GOVERNANCE?.AUTOMATION?.CREATE}.
              </NoticeCard>
            ) : null}

            <div style={{ marginTop: 12, display: 'grid', gap: 22 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Step 1</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: tokens.colors.text.primary }}>What do you want to automate?</div>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                  {[
                    { code: 'RECURRING_JOURNAL_AUTOMATION', label: 'Recurring Journal', desc: 'Create journals from a recurring template.' },
                    { code: 'REVERSAL_AUTOMATION', label: 'Scheduled Reversal', desc: 'Governed reversal of a journal entry.' },
                    { code: 'ACCRUAL_AUTOMATION', label: 'Accrual Automation', desc: 'Coming soon (use Advanced configuration).' },
                    { code: 'ALLOCATION_AUTOMATION', label: 'Allocation Automation', desc: 'Coming soon (use Advanced configuration).' },
                  ].map((opt) => {
                    const selected = String(createAutomationCode) === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          setCreateAutomationCode(opt.code);
                          setCreateTargetId('');
                          setPreviewResult(null);
                        }}
                        style={{
                          gridColumn: 'span 3',
                          textAlign: 'left',
                          padding: 12,
                          borderRadius: 14,
                          border: `1px solid ${selected ? tokens.colors.border.default : tokens.colors.border.subtle}`,
                          background: selected ? tokens.colors.surface.subtle : tokens.colors.white,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>{opt.label}</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>
                  Selected: <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{automationDefinition.label}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Step 2</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: tokens.colors.text.primary }}>Which approved template should run?</div>

                {automationDefinition.code === 'RECURRING_JOURNAL_AUTOMATION' ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Template</div>
                        <div style={{ marginTop: 6 }}>
                          <Input
                            value={recurringTemplateQuery}
                            onChange={(e) => setRecurringTemplateQuery(e.currentTarget.value)}
                            placeholder="Search approved templates"
                          />
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Select</div>
                        <div style={{ marginTop: 6 }}>
                          <select
                            value={createTargetId}
                            onChange={(e) => {
                              setCreateTargetId(String(e.currentTarget.value));
                              setPreviewResult(null);
                            }}
                            style={{
                              width: '100%',
                              height: 40,
                              padding: '0 12px',
                              borderRadius: tokens.radius.sm,
                              border: `1px solid ${tokens.colors.border.default}`,
                              background: tokens.colors.white,
                              fontSize: 14,
                            }}
                          >
                            <option value="">Select an approved template…</option>
                            {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((freq) => {
                              const items = (recurringTemplates ?? [])
                                .filter((t) => {
                                  if (String((t as any)?.frequency ?? '') !== freq) return false;
                                  const q = String(recurringTemplateQuery ?? '').trim().toLowerCase();
                                  if (!q) return true;
                                  const name = String((t as any)?.name ?? '').toLowerCase();
                                  return name.includes(q);
                                })
                                .slice(0, 200);
                              if (items.length === 0) return null;
                              const label = freq === 'MONTHLY' ? 'Monthly' : freq === 'QUARTERLY' ? 'Quarterly' : 'Yearly';
                              return (
                                <optgroup key={freq} label={label}>
                                  {items.map((t) => (
                                    <option key={t.id} value={String(t.id)}>
                                      {t.name} — {label} • Approved
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      {selectedRecurringTemplate ? (
                        <div style={{ padding: 12, borderRadius: 14, background: tokens.colors.surface.subtle }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Selected template</div>
                          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: tokens.colors.text.primary }}>{selectedRecurringTemplate.name}</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
                            Approved • {String((selectedRecurringTemplate as any).frequency ?? '—')} • Created by{' '}
                            {String((selectedRecurringTemplate as any)?.createdBy?.name ?? (selectedRecurringTemplate as any)?.createdBy?.email ?? '—')}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                          Only approved templates are available for scheduling.
                        </div>
                      )}
                    </div>
                  </div>
                ) : automationDefinition.code === 'REVERSAL_AUTOMATION' ? (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                    <div style={{ gridColumn: 'span 5' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Journal entry</div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Input value={journalQuery} onChange={(e) => setJournalQuery(e.currentTarget.value)} placeholder="Search by reference / description" />
                        <Button variant="secondary" size="sm" onClick={searchJournals} disabled={journalSearchLoading}>
                          {journalSearchLoading ? 'Searching…' : 'Search'}
                        </Button>
                      </div>
                      <div style={{ marginTop: 10, display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                        {(journalResults ?? []).map((j) => {
                          const selected = String(createTargetId) === String((j as any).id);
                          return (
                            <button
                              key={(j as any).id}
                              type="button"
                              onClick={() => {
                                setCreateTargetId(String((j as any).id));
                                setPreviewResult(null);
                              }}
                              style={{
                                textAlign: 'left',
                                padding: 10,
                                borderRadius: 12,
                                border: `1px solid ${selected ? tokens.colors.border.default : tokens.colors.border.subtle}`,
                                background: selected ? tokens.colors.surface.subtle : tokens.colors.white,
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>
                                {(j as any).reference || (j as any).id}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.muted }}>
                                {(j as any).description || '—'}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                                Date: {String((j as any).journalDate ?? '—')} | Status: {String((j as any).status ?? '—')}
                              </div>
                            </button>
                          );
                        })}
                        {(journalResults ?? []).length === 0 ? (
                          <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                            Search for journals to select the one to reverse.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 7' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Target summary</div>
                      <div style={{ marginTop: 8, padding: 12, borderRadius: 14, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                        <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Target type</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>{derivedTargetType || '—'}</div>
                        <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>Selected target</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>{createTargetId || '—'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <NoticeCard kind="governance" title="Target configuration">
                      This automation type requires tenant-specific targeting. Use Advanced Technical Configuration to set target type and target id.
                    </NoticeCard>
                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Target ID</div>
                        <div style={{ marginTop: 6 }}>
                          <Input value={createTargetId} onChange={(e) => setCreateTargetId(e.currentTarget.value)} placeholder="Enter target id" />
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 6' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Target type</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>
                          {derivedTargetType || 'Set in Advanced configuration'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Step 3</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: tokens.colors.text.primary }}>When should it run?</div>

                <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: tokens.colors.surface.subtle }}>
                  <div style={{ fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                    This schedule will automatically generate journals on the selected recurrence.
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, alignItems: 'end' }}>
                    {automationDefinition.code === 'RECURRING_JOURNAL_AUTOMATION' ? (
                      <>
                        <div style={{ gridColumn: 'span 3' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Frequency</div>
                          <div style={{ marginTop: 6 }}>
                            <select
                              value={scheduleFrequency}
                              onChange={(e) => setScheduleFrequency(e.currentTarget.value as any)}
                              disabled={!isTargetSelected}
                              style={{
                                width: '100%',
                                height: 40,
                                padding: '0 12px',
                                borderRadius: tokens.radius.sm,
                                border: `1px solid ${tokens.colors.border.default}`,
                                background: tokens.colors.white,
                                fontSize: 14,
                              }}
                            >
                              <option value="MONTHLY">Monthly</option>
                              <option value="QUARTERLY">Quarterly</option>
                              <option value="YEARLY">Yearly</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Run day</div>
                          <div style={{ marginTop: 6 }}>
                            <Input
                              value={scheduleDayOfMonth}
                              onChange={(e) => setScheduleDayOfMonth(e.currentTarget.value)}
                              placeholder="1-28"
                              disabled={!isTargetSelected}
                            />
                          </div>
                        </div>
                        {scheduleFrequency === 'YEARLY' ? (
                          <div style={{ gridColumn: 'span 3' }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Month</div>
                            <div style={{ marginTop: 6 }}>
                              <select
                                value={scheduleMonthUtc}
                                onChange={(e) => setScheduleMonthUtc(e.currentTarget.value)}
                                disabled={!isTargetSelected}
                                style={{
                                  width: '100%',
                                  height: 40,
                                  padding: '0 12px',
                                  borderRadius: tokens.radius.sm,
                                  border: `1px solid ${tokens.colors.border.default}`,
                                  background: tokens.colors.white,
                                  fontSize: 14,
                                }}
                              >
                                {Array.from({ length: 12 }).map((_, i) => (
                                  <option key={i} value={String(i)}>
                                    {new Date(Date.UTC(2020, i, 1)).toLocaleString(undefined, { month: 'long' })}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div style={{ gridColumn: 'span 3' }} />
                        )}
                        <div style={{ gridColumn: 'span 3' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Run time (UTC)</div>
                          <div style={{ marginTop: 6 }}>
                            <Input
                              type="time"
                              value={scheduleTimeUtc}
                              onChange={(e) => setScheduleTimeUtc(e.currentTarget.value)}
                              disabled={!isTargetSelected}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 9' }}>
                        <div style={{ fontSize: 12, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
                          This automation may require an explicit next run time.
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, color: tokens.colors.text.primary }}>
                            <input
                              type="checkbox"
                              checked={useExplicitNextRunAt}
                              onChange={(e) => setUseExplicitNextRunAt(e.currentTarget.checked)}
                              disabled={!isTargetSelected}
                            />
                            Set explicit next run time
                          </label>
                          {useExplicitNextRunAt ? (
                            <div style={{ minWidth: 260 }}>
                              <Input
                                type="datetime-local"
                                value={createNextRunAt}
                                onChange={(e) => setCreateNextRunAt(e.currentTarget.value)}
                                disabled={!isTargetSelected}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <div style={{ gridColumn: 'span 3' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Expiry (optional)</div>
                      <div style={{ marginTop: 6 }}>
                        <Input
                          type="datetime-local"
                          value={createExpiresAt}
                          onChange={(e) => setCreateExpiresAt(e.currentTarget.value)}
                          disabled={!isTargetSelected}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Step 4</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, color: tokens.colors.text.primary }}>Review & Compliance Options</div>

                <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: tokens.colors.surface.subtle }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                    <div style={{ gridColumn: 'span 8' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.primary }}>Approval workflow</div>
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.colors.text.primary }}>
                          <input
                            type="checkbox"
                            checked={governanceAutoSubmitForReview}
                            onChange={(e) => setGovernanceAutoSubmitForReview(e.currentTarget.checked)}
                            disabled={!isTargetSelected}
                          />
                          Automatically send generated journals into the normal approval workflow
                        </label>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                        This doesn’t change who can approve — it controls where generated journals start.
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.primary }}>Schedule status</div>
                      <div style={{ marginTop: 10 }}>
                        <select
                          value={governanceActivationStatus}
                          onChange={(e) => setGovernanceActivationStatus(e.currentTarget.value as any)}
                          disabled={!isTargetSelected}
                          style={{
                            width: '100%',
                            height: 40,
                            padding: '0 12px',
                            borderRadius: tokens.radius.sm,
                            border: `1px solid ${tokens.colors.border.default}`,
                            background: tokens.colors.white,
                            fontSize: 14,
                          }}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="DRAFT">Draft</option>
                          <option value="SUSPENDED">Suspended</option>
                        </select>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                        You can keep it as draft if you’re not ready to run.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setMoreComplianceOpen(!moreComplianceOpen)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: 12,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        background: tokens.colors.white,
                        cursor: 'pointer',
                      }}
                      disabled={!isTargetSelected}
                    >
                      <div style={{ fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>More compliance options</div>
                      <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 900 }}>{moreComplianceOpen ? 'Hide' : 'Show'} ▼</div>
                    </button>

                    {moreComplianceOpen ? (
                      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: tokens.colors.white }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.primary }}>Supporting documentation</div>
                        <div style={{ marginTop: 10 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.colors.text.primary }}>
                            <input
                              type="checkbox"
                              checked={governanceRequireEvidence}
                              onChange={(e) => setGovernanceRequireEvidence(e.currentTarget.checked)}
                              disabled={!isTargetSelected}
                            />
                            Require supporting documentation for each execution
                          </label>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
                          If enabled, executions should attach documentation per policy.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    background: tokens.colors.white,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: tokens.colors.text.primary }}>Advanced options</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>
                      For technical administrators only.
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary, fontWeight: 900 }}>{advancedOpen ? 'Hide' : 'Show'} ▼</div>
                </button>

                {advancedOpen ? (
                  <div style={{ marginTop: 10 }}>
                    <NoticeCard kind="validation" title="Advanced options">
                      These options are intended for technical administrators. Incorrect settings may prevent the schedule from running.
                    </NoticeCard>

                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Target type override</div>
                      <div style={{ marginTop: 6 }}>
                        <Input
                          value={advancedTargetTypeOverride}
                          onChange={(e) => setAdvancedTargetTypeOverride(e.currentTarget.value)}
                          placeholder="e.g. JOURNAL_ENTRY"
                        />
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 8' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Schedule config (JSON)</div>
                      <div style={{ marginTop: 6 }}>
                        <textarea
                          value={advancedScheduleConfigJson}
                          onChange={(e) => setAdvancedScheduleConfigJson(e.currentTarget.value)}
                          rows={7}
                          style={{
                            width: '100%',
                            padding: 10,
                            borderRadius: 10,
                            border: `1px solid ${tokens.colors.border.subtle}`,
                            background: tokens.colors.surface.subtle,
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                ) : null}
              </div>
            </div>

            {previewResult ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Preview</div>

                {(previewResult.warnings ?? []).length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <NoticeCard kind="validation" title="Preview warnings">
                      {(previewResult.warnings ?? []).slice(0, 5).map((w, idx) => (
                        <div key={idx}>{String(w)}</div>
                      ))}
                    </NoticeCard>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <NoticeCard kind="success" title="Preview looks good">
                      Next execution times computed successfully.
                    </NoticeCard>
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
                  <div style={{ gridColumn: 'span 7', padding: 12, borderRadius: 14, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.primary }}>Next execution dates (UTC)</div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                      {(previewResult.nextRuns ?? []).map((ts, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                          <div style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Run {idx + 1}</div>
                          <div style={{ color: tokens.colors.text.secondary }}>{formatDateTime(ts)}</div>
                        </div>
                      ))}
                      {(previewResult.nextRuns ?? []).length === 0 ? (
                        <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                          No computed run times. Provide a valid schedule configuration or explicit next run time.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 5', padding: 12, borderRadius: 14, border: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.subtle }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.primary }}>Governance summary</div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, color: tokens.colors.text.secondary }}>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Automation:</span> {automationDefinition.label}
                      </div>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Target type:</span> {derivedTargetType || '—'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Target:</span> {createTargetId || '—'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Evidence required:</span> {governanceRequireEvidence ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Auto-submit for review:</span> {governanceAutoSubmitForReview ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>Expiry:</span> {createExpiresAt ? formatDateTime(new Date(createExpiresAt).toISOString()) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Supervised Sweep Orchestration"
            subtitle="Dry-run evaluates governance eligibility and violations. Execute mode requires explicit confirmation and respects governance blocks."
            actions={
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button variant={sweepExecute ? 'destructive' : 'secondary'} size="sm" onClick={() => setSweepExecute(!sweepExecute)} disabled={!canExecute}>
                  {sweepExecute ? 'Execute: ON' : 'Execute: OFF'}
                </Button>
                <Button variant="accent" size="sm" onClick={runSweep} disabled={sweepRunning || !canExecute}>
                  {sweepRunning ? 'Running…' : sweepExecute ? 'Run Sweep (Execute)' : 'Run Sweep (Dry-run)'}
                </Button>
              </div>
            }
          >
            {!canExecute ? (
              <NoticeCard kind="permission" title="Execute permission required">
                You have view-only access. Supervised sweep execution requires {(PERMISSIONS as any).GOVERNANCE?.AUTOMATION?.EXECUTE}.
              </NoticeCard>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, marginTop: 12 }}>
              <div style={{ gridColumn: 'span 4' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Now (UTC)</div>
                <div style={{ marginTop: 6 }}>
                  <Input type="datetime-local" value={sweepNow} onChange={(e) => setSweepNow(e.currentTarget.value)} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Limit</div>
                <div style={{ marginTop: 6 }}>
                  <Input value={sweepLimit} onChange={(e) => setSweepLimit(e.currentTarget.value)} />
                </div>
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: tokens.colors.text.secondary }}>Options</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.colors.text.primary }}>
                    <input
                      type="checkbox"
                      checked={sweepIncludeSuspended}
                      onChange={(e) => setSweepIncludeSuspended(e.currentTarget.checked)}
                    />
                    Include suspended schedules
                  </label>
                  <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                    Execute mode requires explicit confirmation per run.
                  </div>
                </div>
              </div>
            </div>

            {sweepResult ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: tokens.colors.text.secondary }}>Sweep Result Summary</div>
                <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.text.primary }}>
                  Due count: <span style={{ fontWeight: 900 }}>{String(sweepResult?.dueCount ?? '0')}</span>
                </div>
                <pre
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    background: tokens.colors.surface.subtle,
                    overflowX: 'auto',
                    fontSize: 12,
                    lineHeight: '18px',
                  }}
                >
                  {JSON.stringify(sweepResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Lifecycle-governed Schedules"
            subtitle="Schedules are governance entities with lifecycle state, failure counters, expiry, and supervised execution." 
          >
            <div style={{ marginBottom: 12 }}>
              <NoticeCard kind="info" title="Reading schedules (audit-friendly)">
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 900 }}>Status</span> reflects lifecycle state (e.g., review required, suspended, failed).
                  </div>
                  <div>
                    <span style={{ fontWeight: 900 }}>Activation</span> reflects whether the schedule is permitted to run (active/draft/suspended).
                  </div>
                  <div>
                    Evidence and review settings are enforced during execution and recorded on execution sessions for audit.
                  </div>
                </div>
              </NoticeCard>
            </div>
            <DataTable>
              <DataTable.Head sticky>
                <DataTable.Row>
                  <DataTable.Th>Status</DataTable.Th>
                  <DataTable.Th>Activation</DataTable.Th>
                  <DataTable.Th>Automation</DataTable.Th>
                  <DataTable.Th>Target</DataTable.Th>
                  <DataTable.Th>Next</DataTable.Th>
                  <DataTable.Th>Last</DataTable.Th>
                  <DataTable.Th>Approved</DataTable.Th>
                  <DataTable.Th>Created</DataTable.Th>
                  <DataTable.Th>Failures</DataTable.Th>
                  <DataTable.Th align="right">Inspect</DataTable.Th>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body>
                {(schedules ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '20px 12px' }}>
                      <EmptyState
                        title={loading ? 'Loading…' : 'No automation schedules found'}
                        description="Schedules define what will run, when it will run, and what governance controls apply (activation status, evidence requirements, and review submission)."
                        primaryAction={
                          canCreate
                            ? {
                                label: 'Create schedule',
                                onClick: () => {
                                  const el = document.getElementById('automation-create-schedule');
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                },
                              }
                            : undefined
                        }
                        secondaryAction={{
                          label: 'Refresh',
                          onClick: () => refresh(),
                          disabled: loading,
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  (schedules ?? []).map((s, idx) => (
                    <DataTable.Row key={s.id} zebra index={idx}>
                      <DataTable.Td>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>{safeUpper((s as any).scheduleStatus)}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>{safeUpper((s as any).activationStatus ?? '—')}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontWeight: 800, fontSize: 12 }}>{s.automationCode}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12 }}>
                          {s.targetType}:{' '}
                          <span
                            title={String(s.targetId ?? '')}
                            style={{
                              color: tokens.colors.text.muted,
                              display: 'inline-block',
                              maxWidth: 260,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              verticalAlign: 'bottom',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.targetId}
                          </span>
                        </div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(s.nextRunAt)}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(s.lastRunAt)}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime((s as any).approvedAt ?? null)}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(s.createdAt)}</div>
                        <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>{String(s.createdById ?? '')}</div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 900 }}>{String(s.consecutiveFailureCount ?? 0)}</span>
                          {s.lastFailureReason ? (
                            <span
                              title={String(s.lastFailureReason)}
                              style={{
                                color: tokens.colors.text.muted,
                                display: 'inline-block',
                                maxWidth: 320,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                verticalAlign: 'bottom',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {' '}
                              — {String(s.lastFailureReason)}
                            </span>
                          ) : null}
                        </div>
                      </DataTable.Td>
                      <DataTable.Td align="right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/settings/governance/automation/schedules/${s.id}`)}
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

        <div style={{ gridColumn: 'span 12' }}>
          <Card
            title="Recent Execution Activity"
            subtitle="Execution sessions capture governance metadata, evidence/override linkage, escalation and outcome for audit-defensible operations." 
          >
            <div style={{ marginBottom: 12 }}>
              <NoticeCard kind="info" title="Reading executions (audit-friendly)">
                <div style={{ display: 'grid', gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 900 }}>Severity</span> reflects policy severity from governance metadata.
                  </div>
                  <div>
                    <span style={{ fontWeight: 900 }}>Indicators</span> highlight evidence linkage, escalations, and override association.
                  </div>
                </div>
              </NoticeCard>
            </div>
            <DataTable>
              <DataTable.Head sticky>
                <DataTable.Row>
                  <DataTable.Th>Severity</DataTable.Th>
                  <DataTable.Th>Status</DataTable.Th>
                  <DataTable.Th>Automation</DataTable.Th>
                  <DataTable.Th>Started</DataTable.Th>
                  <DataTable.Th>Indicators</DataTable.Th>
                  <DataTable.Th align="right">Inspect</DataTable.Th>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body>
                {recentExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px 12px' }}>
                      <EmptyState
                        title={loading ? 'Loading…' : 'No execution sessions found'}
                        description="Executions provide audit evidence of what ran, what was affected, and whether governance policy raised warnings or blocks."
                        secondaryAction={{
                          label: 'Refresh',
                          onClick: () => refresh(),
                          disabled: loading,
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  recentExecutions.map((ex, idx) => {
                    const severity = getExecutionSeverity(ex);
                    const status = safeUpper((ex as any).executionStatus);
                    const isSuspended = status === 'SUSPENDED';

                    return (
                      <DataTable.Row key={ex.id} zebra index={idx}>
                        <DataTable.Td>
                          <AutomationSeverityBadge severity={severity} />
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontWeight: 900, fontSize: 12 }}>{status}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontWeight: 800, fontSize: 12 }}>{ex.automationCode}</div>
                          {ex.scheduleId ? (
                            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Schedule: {ex.scheduleId}</div>
                          ) : null}
                        </DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime((ex as any).startedAt)}</div>
                        </DataTable.Td>
                        <DataTable.Td>
                          <AutomationIndicators
                            hasOverride={Boolean((ex as any).overrideSessionId)}
                            hasEvidence={hasEvidence(ex)}
                            hasEscalation={Boolean((ex as any).escalationType) || Boolean((ex as any).escalationReason)}
                            isSuspended={isSuspended}
                          />
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
                    );
                  })
                )}
              </DataTable.Body>
            </DataTable>
          </Card>
        </div>
      </div>

      {sweepConfirm ? (
        <ModalShell
          title="Confirm supervised execution"
          subtitle="This will attempt explicit execution for governance-eligible schedules. Executions will be recorded for audit and may be blocked by policy."
          onClose={() => {
            if (sweepRunning) return;
            setSweepConfirm(null);
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" disabled={sweepRunning} onClick={() => setSweepConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={sweepRunning}
                onClick={() => {
                  const payload = sweepConfirm;
                  setSweepConfirm(null);
                  if (!payload) return;
                  executeSweep(payload);
                }}
              >
                Execute now
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <NoticeCard kind="governance" title="Execution details">
              <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                <div>
                  <span style={{ color: tokens.colors.text.secondary }}>Time (UTC):</span>{' '}
                  <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{sweepConfirm.nowIso}</span>
                </div>
                <div>
                  <span style={{ color: tokens.colors.text.secondary }}>Limit:</span>{' '}
                  <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{String(sweepConfirm.limit)}</span>
                </div>
                <div>
                  <span style={{ color: tokens.colors.text.secondary }}>Include suspended:</span>{' '}
                  <span style={{ fontWeight: 900, color: tokens.colors.text.primary }}>{sweepIncludeSuspended ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </NoticeCard>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted, lineHeight: '18px' }}>
              Use dry-run mode when you only want eligibility and governance outcome preview without executing changes.
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
