import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import type { GovernanceSeverity } from './governance-severity';
import type { GovernanceActionType } from './governance-action-registry';
import { buildGovernanceAuditMetadata } from './governance-enforcement';
import {
  getOverridePolicy,
  type OverrideCode,
  type OverrideEntryPoint,
} from './override-governance-registry';
import type { OverrideSeverity } from './override-severity';

export type OverrideSessionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'REVOKED';

export type OverrideApprovalState = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: Date | string | null;
  rejectedById?: string | null;
  rejectedAt?: Date | string | null;
  mode?: string | null;
};

export type OverrideEvidenceRef = {
  id: string;
  evidenceCategory?: string | null;
  fileName?: string | null;
};

export type OverrideSessionContext = {
  id: string;
  overrideCode: OverrideCode;
  tenantId: string;
  actorUserId: string;
  governanceDomain: string;
  severity: OverrideSeverity;
  reason: string;
  justification: string;
  status: OverrideSessionStatus;
  createdAt: Date | string;
  expiresAt?: Date | string | null;
  requestId?: string | null;

  escalation?: { type?: string; reason?: string } | null;
  approval?: OverrideApprovalState | null;
  evidence?: OverrideEvidenceRef[] | null;
};

export type ActorLegalEntityAuthority = {
  legalEntityId: string;
  canOverride?: boolean | null;
  expiresAt?: Date | string | null;
};

export type OverrideGovernanceContext = {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  permissionUsed: string;

  entryPoint: OverrideEntryPoint;
  overrideCode: OverrideCode;

  reason?: string | null;
  justificationText?: string | null;

  escalation?: { type?: string; reason?: string } | null;
  attachments?: OverrideEvidenceRef[];

  actorRoleCodes?: string[];

  legalEntityIdsTouched?: string[];
  actorLegalEntityAuthority?: ActorLegalEntityAuthority[];

  approval?: OverrideApprovalState | null;
  overrideSession?: OverrideSessionContext | null;
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isExpired(expiresAt: Date | string | null | undefined): boolean {
  const d = toDate(expiresAt);
  if (!d) return false;
  return d.getTime() <= Date.now();
}

function hasAllowedRole(params: {
  allowedRoles: string[];
  actorRoleCodes: string[];
}): boolean {
  const allowed = new Set(params.allowedRoles.map((r) => String(r).trim()));
  for (const r of params.actorRoleCodes) {
    if (allowed.has(String(r).trim())) return true;
  }
  return false;
}

function throwOverrideViolation(params: {
  actionType: GovernanceActionType;
  message: string;
  ctx: OverrideGovernanceContext;
  details?: any;
}): never {
  const meta = buildGovernanceAuditMetadata({
    actionType: params.actionType,
    permissionUsed: params.ctx.permissionUsed,
    actorUserId: params.ctx.actorUserId,
    tenantId: params.ctx.tenantId,
    req: params.ctx.req,
    after: {
      overrideCode: params.ctx.overrideCode,
      entryPoint: params.ctx.entryPoint,
      escalation: params.ctx.escalation ?? null,
      approval: params.ctx.approval ?? null,
      attachmentCount: (params.ctx.attachments ?? []).length,
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'OVERRIDE_GOVERNANCE_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

export function assertOverrideGovernance(ctx: OverrideGovernanceContext): {
  policy: {
    overrideCode: OverrideCode;
    governanceDomain: string;
    severity: OverrideSeverity;
    escalationRequired: boolean;
    evidenceRequired: boolean;
    minimumEvidenceCount: number;
    approvalRequired: boolean;
    maxDurationMinutes: number;
    expiryRequired: boolean;
    requiresReason: boolean;
    requiresJustification: boolean;
    requiresSecondaryReviewer: boolean;
    auditSensitivity: GovernanceSeverity;
  };
} {
  const policy = getOverridePolicy(ctx.overrideCode);
  if (!policy) {
    throw new BadRequestException(`Unknown overrideCode: ${ctx.overrideCode}`);
  }

  if (policy.allowedEntryPoints !== 'ANY') {
    const ok = policy.allowedEntryPoints.includes(ctx.entryPoint);
    if (!ok) {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Override is not allowed from this entry point',
        ctx,
        details: { allowedEntryPoints: policy.allowedEntryPoints },
      });
    }
  }

  const actorRoles = Array.isArray(ctx.actorRoleCodes) ? ctx.actorRoleCodes : [];
  if (policy.allowedRoles.length > 0 && actorRoles.length > 0) {
    const ok = hasAllowedRole({ allowedRoles: policy.allowedRoles, actorRoleCodes: actorRoles });
    if (!ok) {
      throw new ForbiddenException('Actor role is not authorized for this override policy');
    }
  }

  const reason = String(ctx.reason ?? '').trim();
  const justification = String(ctx.justificationText ?? '').trim();

  if (policy.requiresReason && reason.length < 3) {
    throwOverrideViolation({
      actionType: 'GOVERNANCE_JUSTIFICATION_REQUIRED',
      message: 'Override reason is required',
      ctx,
    });
  }

  if (policy.requiresJustification && justification.length < 3) {
    throwOverrideViolation({
      actionType: 'GOVERNANCE_JUSTIFICATION_REQUIRED',
      message: 'Override justification is required',
      ctx,
    });
  }

  if (policy.escalationRequired) {
    const escReason = String(ctx.escalation?.reason ?? '').trim();
    if (!ctx.escalation?.type || escReason.length < 3) {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Escalation is required for this override',
        ctx,
      });
    }
  }

  const attachments = Array.isArray(ctx.attachments) ? ctx.attachments : [];
  if (policy.evidenceRequired) {
    if (attachments.length < Math.max(0, policy.minimumEvidenceCount)) {
      throwOverrideViolation({
        actionType: 'MISSING_SUPPORT_DOCUMENT',
        message: 'Supporting evidence is required for this override',
        ctx,
        details: {
          minimumEvidenceCount: policy.minimumEvidenceCount,
        },
      });
    }
  }

  if (policy.approvalRequired) {
    const a = ctx.approval;
    if (!a || a.status !== 'APPROVED') {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Approval is required for this override',
        ctx,
      });
    }
  }

  if (policy.expiryRequired) {
    const exp = ctx.overrideSession?.expiresAt;
    if (!exp) {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Expiry is required for this override',
        ctx,
      });
    }
    if (isExpired(exp)) {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Override session is expired',
        ctx,
      });
    }
  }

  if (Array.isArray(ctx.legalEntityIdsTouched) && ctx.legalEntityIdsTouched.length > 0) {
    const authority = Array.isArray(ctx.actorLegalEntityAuthority)
      ? ctx.actorLegalEntityAuthority
      : [];

    const allowed = new Set(
      authority
        .filter((a) => a && a.legalEntityId)
        .filter((a) => !isExpired(a.expiresAt))
        .filter((a) => Boolean(a.canOverride))
        .map((a) => String(a.legalEntityId)),
    );

    const missing = ctx.legalEntityIdsTouched
      .map((x) => String(x).trim())
      .filter(Boolean)
      .filter((x) => !allowed.has(x));

    if (missing.length > 0) {
      throwOverrideViolation({
        actionType: 'ESCALATION_OVERRIDE',
        message: 'Actor does not have legal-entity override authority for all affected legal entities',
        ctx,
        details: { missingLegalEntityIds: missing },
      });
    }
  }

  return {
    policy: {
      overrideCode: policy.overrideCode,
      governanceDomain: policy.governanceDomain,
      severity: policy.severity,
      escalationRequired: policy.escalationRequired,
      evidenceRequired: policy.evidenceRequired,
      minimumEvidenceCount: policy.minimumEvidenceCount,
      approvalRequired: policy.approvalRequired,
      maxDurationMinutes: policy.maxDurationMinutes,
      expiryRequired: policy.expiryRequired,
      requiresReason: policy.requiresReason,
      requiresJustification: policy.requiresJustification,
      requiresSecondaryReviewer: policy.requiresSecondaryReviewer,
      auditSensitivity: policy.auditSensitivity,
    },
  };
}
