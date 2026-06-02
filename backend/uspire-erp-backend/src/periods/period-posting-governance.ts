import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { PeriodStatus } from './period-semantics';

function toStatus(status: any): PeriodStatus {
  const s = status as PeriodStatus;
  if (s === PeriodStatus.CLOSED) return PeriodStatus.HARD_CLOSED;
  return s;
}

export type PostingGovernanceContext = {
  permissionCodes?: Iterable<string>;
  governanceReason?: string;
  getEscalation?: () => unknown;
  setEscalation?: (escalation: { type: string; reason: string }) => void;
};

function readGovernanceReason(req: Request): string {
  return String(req.header('x-governance-reason') ?? '').trim();
}

function readPermissionCodes(params: {
  req?: Request;
  context?: PostingGovernanceContext;
}): Set<string> {
  if (params.context?.permissionCodes) {
    return new Set(Array.from(params.context.permissionCodes).map(String));
  }

  if (params.req) {
    const perms = (params.req as any)?.user?.permissions;
    if (Array.isArray(perms)) {
      return new Set(perms.map(String));
    }
  }

  return new Set();
}

function readReason(params: {
  req?: Request;
  context?: PostingGovernanceContext;
}): string {
  const reason = String(params.context?.governanceReason ?? '').trim();
  if (reason) return reason;
  return params.req ? readGovernanceReason(params.req) : '';
}

function getEscalation(params: {
  req?: Request;
  context?: PostingGovernanceContext;
}): unknown {
  if (params.context?.getEscalation) return params.context.getEscalation();
  if (params.req) return (params.req as any).governanceEscalation;
  return undefined;
}

function setEscalation(params: {
  req?: Request;
  context?: PostingGovernanceContext;
  escalation: { type: string; reason: string };
}) {
  if (params.context?.setEscalation) {
    params.context.setEscalation(params.escalation);
    return;
  }
  if (params.req) {
    (params.req as any).governanceEscalation = params.escalation;
  }
}

export function assertPeriodAllowsPosting(params: {
  req?: Request;
  context?: PostingGovernanceContext;
  period: { id: string; name?: string | null; status: any };
  permissionUsed: string;
}) {
  const s = toStatus(params.period.status);
  if (s === PeriodStatus.OPEN || String(s).toUpperCase() === 'ACTIVE') return;

  const periodName = String(params.period.name ?? '').trim();
  const suffix = periodName ? `: ${periodName}` : '';

  if (s === PeriodStatus.SOFT_CLOSED) {
    const codes = readPermissionCodes({ req: params.req, context: params.context });
    const allowed = codes.has(PERMISSIONS.PERIOD.SOFT_CLOSE_POST_OVERRIDE);

    if (!allowed) {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is SOFT_CLOSED${suffix}`,
      });
    }

    const reason = readReason({ req: params.req, context: params.context });
    if (!reason || reason.length < 3) {
      throw new ForbiddenException(
        'Governance reason is required for posting in a SOFT_CLOSED period. Provide x-governance-reason header.',
      );
    }

    if (params.req) {
      const sessionId = String(params.req.header('x-override-session-id-period') ?? '').trim();
      if (!sessionId) {
        throw new ForbiddenException(
          'Override session is required for posting in a SOFT_CLOSED period. Provide x-override-session-id-period header.',
        );
      }
      (params.req as any).governanceOverrideSessionIdPeriod = sessionId;
    }

    if (!getEscalation({ req: params.req, context: params.context })) {
      setEscalation({
        req: params.req,
        context: params.context,
        escalation: {
          type: 'PERIOD_SOFT_CLOSE_POST_OVERRIDE',
          reason,
        },
      });
    }

    return;
  }

  if (s === PeriodStatus.HARD_CLOSED || s === PeriodStatus.ARCHIVED) {
    throw new ForbiddenException({
      error: 'Posting blocked by accounting period control',
      reason: `Accounting period is not OPEN${suffix}`,
    });
  }

  throw new ForbiddenException({
    error: 'Posting blocked by accounting period control',
    reason: `Accounting period is not OPEN${suffix}`,
  });
}
