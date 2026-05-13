import { apiFetch } from './api';

export type AutomationScheduleStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'
  | string;

export type GovernanceAutomationScheduleRow = {
  id: string;
  tenantId: string;

  automationCode: string;
  scheduleStatus: AutomationScheduleStatus;

  activationStatus?: string;
  approvedById?: string | null;
  approvedAt?: string | null;

  targetType: string;
  targetId: string;

  scheduleConfig: any;

  nextRunAt: string | null;
  lastRunAt: string | null;
  expiresAt: string | null;

  suspendedAt: string | null;
  suspendedById: string | null;

  revokedAt: string | null;
  revokedById: string | null;

  reviewRequiredAt?: string | null;

  consecutiveFailureCount: number;
  lastFailureReason: string | null;

  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export async function createAutomationSchedule(params: {
  automationCode: string;
  targetType: string;
  targetId: string;
  scheduleConfig?: any;
  nextRunAt?: string;
  expiresAt?: string;
}) {
  return apiFetch<GovernanceAutomationScheduleRow>('/governance/automation-schedules', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function previewAutomationSchedule(params: {
  automationCode: string;
  targetType: string;
  targetId: string;
  scheduleConfig?: any;
  nextRunAt?: string;
  expiresAt?: string;
  now?: string;
  count?: number;
}) {
  return apiFetch<{ now: string; count: number; warnings: string[]; nextRuns: string[] }>(
    '/governance/automation-schedules/preview',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );
}

export async function listAutomationSchedules(params?: {
  automationCode?: string;
  scheduleStatus?: string;
  targetType?: string;
  targetId?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.automationCode) sp.set('automationCode', params.automationCode);
  if (params?.scheduleStatus) sp.set('scheduleStatus', params.scheduleStatus);
  if (params?.targetType) sp.set('targetType', params.targetType);
  if (params?.targetId) sp.set('targetId', params.targetId);
  const qs = sp.toString();

  return apiFetch<GovernanceAutomationScheduleRow[]>(
    `/governance/automation-schedules${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export async function getAutomationSchedule(scheduleId: string) {
  const id = String(scheduleId ?? '').trim();
  return apiFetch<GovernanceAutomationScheduleRow>(`/governance/automation-schedules/${id}`, {
    method: 'GET',
  });
}

export async function suspendAutomationSchedule(scheduleId: string, params?: { reason?: string }) {
  const id = String(scheduleId ?? '').trim();
  return apiFetch<GovernanceAutomationScheduleRow>(`/governance/automation-schedules/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason }),
  });
}

export async function resumeAutomationSchedule(scheduleId: string) {
  const id = String(scheduleId ?? '').trim();
  return apiFetch<GovernanceAutomationScheduleRow>(`/governance/automation-schedules/${id}/resume`, {
    method: 'POST',
  });
}

export async function revokeAutomationSchedule(scheduleId: string, params?: { reason?: string }) {
  const id = String(scheduleId ?? '').trim();
  return apiFetch<GovernanceAutomationScheduleRow>(`/governance/automation-schedules/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason: params?.reason }),
  });
}

export async function executeAutomationSchedule(scheduleId: string, params?: {
  runAt?: string;
  autoSubmitForReview?: boolean;
  evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;
  overrideSessionId?: string;
  governanceReason?: string;
}) {
  const id = String(scheduleId ?? '').trim();
  return apiFetch<any>(`/governance/automation-schedules/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

export async function sweepDueAutomationSchedules(params?: {
  now?: string;
  limit?: number;
  execute?: boolean;
  includeSuspended?: boolean;
  autoSubmitForReview?: boolean;
  evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;
  overrideSessionId?: string;
  governanceReason?: string;
}) {
  return apiFetch<{
    now: string;
    execute: boolean;
    dueCount: number;
    results: any[];
  }>('/governance/automation-schedules/sweep-due', {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}
