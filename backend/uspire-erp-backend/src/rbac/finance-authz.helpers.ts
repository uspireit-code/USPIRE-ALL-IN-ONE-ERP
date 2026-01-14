import { ForbiddenException } from '@nestjs/common';
import type { AccountingPeriodStatus, SoDRule } from '@prisma/client';
import { assertCanPost } from '../periods/period-guard';

export type AuthzUserLike = {
  id: string;
  permissionCodes: Set<string>;
};

export function requirePermission(user: AuthzUserLike, permission: string) {
  // Phase 2: enforcement will be added here (controllers/services will call this helper).
  if (!user.permissionCodes.has(permission)) {
    throw new ForbiddenException({
      error: 'Access denied',
      missingPermission: permission,
    });
  }
}

export function requireAnyPermission(
  user: AuthzUserLike,
  permissions: string[],
) {
  // Phase 2: enforcement will be added here (controllers/services will call this helper).
  const ok = permissions.some((p) => user.permissionCodes.has(p));
  if (!ok) {
    throw new ForbiddenException({
      error: 'Access denied',
      missingAnyOf: permissions,
    });
  }
}

export function requireOwnership(params: {
  createdById: string;
  userId: string;
  message?: string;
}) {
  // Phase 2: enforcement will be added here (maker-checker + ownership checks).
  if (params.createdById !== params.userId) {
    throw new ForbiddenException(
      params.message ?? 'Only the creator can perform this action',
    );
  }
}

export type SoDSeparationRule = {
  label: string;
  aUserId: string | null | undefined;
  bUserId: string | null | undefined;
};

export function requireSoDSeparation(rule: SoDSeparationRule) {
  // Phase 2: enforcement will be added here (preparer/reviewer/approver separation).
  const a = rule.aUserId ?? null;
  const b = rule.bUserId ?? null;
  if (!a || !b) return;
  if (a === b) {
    throw new ForbiddenException({
      error: 'Action blocked by Segregation of Duties (SoD)',
      reason: `${rule.label}: users must be different`,
    });
  }
}

export function detectSoDConflictFromRules(params: {
  requiredPermissions: string[];
  userPermissionCodes: Set<string>;
  rules: Array<Pick<SoDRule, 'forbiddenPermissionA' | 'forbiddenPermissionB'>>;
}): null | { permissionAttempted: string; conflictingPermission: string } {
  // Phase 2: enforcement will be added here (centralized SoD checks; not wired yet).
  for (const attempted of params.requiredPermissions) {
    for (const rule of params.rules) {
      if (
        rule.forbiddenPermissionA === attempted &&
        params.userPermissionCodes.has(rule.forbiddenPermissionB)
      ) {
        return {
          permissionAttempted: attempted,
          conflictingPermission: rule.forbiddenPermissionB,
        };
      }
      if (
        rule.forbiddenPermissionB === attempted &&
        params.userPermissionCodes.has(rule.forbiddenPermissionA)
      ) {
        return {
          permissionAttempted: attempted,
          conflictingPermission: rule.forbiddenPermissionA,
        };
      }
    }
  }
  return null;
}

export function requirePeriodOpen(params: {
  status: AccountingPeriodStatus;
  periodName?: string;
}) {
  // Phase 2: enforcement will be added here (posting/subledger posting/close controls).
  try {
    // Legacy helper semantics require OPEN.
    // Use canonical period semantics but preserve legacy error payload/wording below.
    assertCanPost(params.status, { periodName: params.periodName });
  } catch {
    throw new ForbiddenException({
      error: 'Action blocked by accounting period control',
      reason: params.periodName
        ? `Accounting period is not OPEN: ${params.periodName}`
        : 'Accounting period is not OPEN',
    });
  }
}

export type AuditStubEvent = {
  type: string;
  payload: Record<string, any>;
};

export async function auditEventStub(_event: AuditStubEvent): Promise<void> {
  // Phase 2: enforcement will be added here (emit audit events via existing audit pipeline).
  return;
}
