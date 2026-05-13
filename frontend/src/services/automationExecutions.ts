import { apiFetch } from './api';

export type AutomationExecutionStatus =
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | string;

export type GovernanceAutomationExecutionRow = {
  id: string;
  tenantId: string;

  automationCode: string;
  scheduleId: string | null;

  executionStatus: AutomationExecutionStatus;

  actorType: string;
  actorUserId: string | null;

  startedAt: string;
  completedAt: string | null;

  failureReason: string | null;

  retryCount: number;

  overrideSessionId: string | null;
  escalationType: string | null;
  escalationReason: string | null;

  evidenceMetadata: any;
  governanceMetadata: any;

  executionResult: any;
};

export async function listAutomationExecutions(params?: {
  automationCode?: string;
  scheduleId?: string;
  executionStatus?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.automationCode) sp.set('automationCode', params.automationCode);
  if (params?.scheduleId) sp.set('scheduleId', params.scheduleId);
  if (params?.executionStatus) sp.set('executionStatus', params.executionStatus);
  const qs = sp.toString();

  return apiFetch<GovernanceAutomationExecutionRow[]>(
    `/governance/automation-executions${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export async function getAutomationExecution(executionId: string) {
  const id = String(executionId ?? '').trim();
  return apiFetch<GovernanceAutomationExecutionRow>(`/governance/automation-executions/${id}`, {
    method: 'GET',
  });
}
