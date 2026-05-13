import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import { buildGovernanceAuditMetadata } from './governance-enforcement';
import {
  getAutomationPolicy,
  type AutomationCode,
  type AutomationPolicyDefinition,
} from './automation-governance-registry';

export type AutomationActorType = 'SYSTEM' | 'USER' | 'SUPERVISOR';

export type AutomationExecutionContext = {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  actorType: AutomationActorType;
  permissionUsed: string;

  automationCode: AutomationCode;

  now?: Date;

  journalType?: string | null;
  legalEntityIdsTouched?: string[];

  evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;

  escalation?: { type?: string; reason?: string } | null;

  overrideSessionId?: string | null;
  overrideCodesUsed?: string[];

  retryCount?: number;
  lastExecutionAt?: Date | string | null;

  isSuspended?: boolean;
};

function isWithinAllowedWindows(params: {
  now: Date;
  windows?: Array<{ startHourUtc: number; endHourUtc: number }>;
}): boolean {
  const windows = params.windows;
  if (!windows || windows.length === 0) return true;

  const hour = params.now.getUTCHours();
  return windows.some((w) => {
    const start = Math.max(0, Math.min(23, Math.floor(w.startHourUtc)));
    const end = Math.max(0, Math.min(24, Math.floor(w.endHourUtc)));

    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    // wrap-around windows (e.g. 22-2)
    return hour >= start || hour < end;
  });
}

function throwAutomationViolation(params: {
  message: string;
  ctx: AutomationExecutionContext;
  policy: AutomationPolicyDefinition;
  details?: any;
}): never {
  const meta = buildGovernanceAuditMetadata({
    actionType: 'AUTOMATION_GOVERNANCE_VIOLATION' as any,
    permissionUsed: params.ctx.permissionUsed,
    actorUserId: params.ctx.actorUserId,
    tenantId: params.ctx.tenantId,
    req: params.ctx.req,
    after: {
      automationCode: params.ctx.automationCode,
      actorType: params.ctx.actorType,
      journalType: params.ctx.journalType ?? null,
      overrideSessionId: params.ctx.overrideSessionId ?? null,
      overrideCodesUsed: params.ctx.overrideCodesUsed ?? [],
      retryCount: params.ctx.retryCount ?? 0,
      evidenceCount: (params.ctx.evidenceRefs ?? []).length,
      escalation: params.ctx.escalation ?? null,
      policy: {
        automationMode: params.policy.automationMode,
        severity: params.policy.severity,
        auditSensitivity: params.policy.auditSensitivity,
      },
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'AUTOMATION_GOVERNANCE_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

export function assertAutomationGovernance(ctx: AutomationExecutionContext): {
  policy: AutomationPolicyDefinition;
} {
  const policy = getAutomationPolicy(ctx.automationCode);
  if (!policy) {
    throw new BadRequestException(`Unknown automationCode: ${ctx.automationCode}`);
  }

  if (ctx.isSuspended) {
    throwAutomationViolation({
      message: 'Automation is suspended',
      ctx,
      policy,
    });
  }

  const now = ctx.now ?? new Date();
  if (!isWithinAllowedWindows({ now, windows: policy.allowedExecutionWindows })) {
    throwAutomationViolation({
      message: 'Automation execution is outside allowed execution window',
      ctx,
      policy,
      details: { allowedExecutionWindows: policy.allowedExecutionWindows ?? [] },
    });
  }

  const lastExecutionAt = ctx.lastExecutionAt ? new Date(String(ctx.lastExecutionAt)) : null;
  if (lastExecutionAt && !Number.isNaN(lastExecutionAt.getTime())) {
    const minMinutes = Math.max(0, Math.floor(Number(policy.maxExecutionFrequencyMinutes ?? 0)));
    if (minMinutes > 0) {
      const diffMs = now.getTime() - lastExecutionAt.getTime();
      const diffMinutes = diffMs / (60 * 1000);
      if (diffMinutes >= 0 && diffMinutes < minMinutes) {
        throwAutomationViolation({
          message: 'Automation execution is too frequent for the policy',
          ctx,
          policy,
          details: {
            maxExecutionFrequencyMinutes: minMinutes,
            lastExecutionAt: lastExecutionAt.toISOString(),
            now: now.toISOString(),
            diffMinutes,
          },
        });
      }
    }
  }

  if (policy.allowedJournalTypes !== 'ANY') {
    const jt = String(ctx.journalType ?? '').trim().toUpperCase();
    const allowed = new Set(policy.allowedJournalTypes.map((x) => String(x).trim().toUpperCase()));
    if (jt && !allowed.has(jt)) {
      throwAutomationViolation({
        message: 'Automation is not allowed for this journal type',
        ctx,
        policy,
        details: { allowedJournalTypes: policy.allowedJournalTypes, journalType: jt },
      });
    }
  }

  const evidenceCount = Array.isArray(ctx.evidenceRefs) ? ctx.evidenceRefs.length : 0;
  if (policy.evidenceRequired && evidenceCount < Math.max(0, policy.minimumEvidenceCount)) {
    throwAutomationViolation({
      message: 'Automation requires supporting evidence',
      ctx,
      policy,
      details: { minimumEvidenceCount: policy.minimumEvidenceCount, evidenceCount },
    });
  }

  if (policy.escalationAllowed === false && ctx.escalation) {
    throwAutomationViolation({
      message: 'Escalation is not permitted for this automation policy',
      ctx,
      policy,
    });
  }

  if (policy.overrideAllowed === false && (ctx.overrideSessionId || (ctx.overrideCodesUsed ?? []).length > 0)) {
    throw new ForbiddenException('Overrides are not permitted for this automation policy');
  }

  const retryCount = Math.max(0, Math.floor(Number(ctx.retryCount ?? 0)));
  if (retryCount > policy.retryPolicy.maxRetries) {
    throwAutomationViolation({
      message: 'Retry is not permitted (max retries exceeded)',
      ctx,
      policy,
      details: { maxRetries: policy.retryPolicy.maxRetries, retryCount },
    });
  }

  return { policy };
}
