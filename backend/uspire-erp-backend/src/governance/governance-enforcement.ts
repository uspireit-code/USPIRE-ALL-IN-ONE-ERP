import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import type { GovernanceDomainCode } from './governance-domain-registry';
import type { GovernanceActionType } from './governance-action-registry';
import { getGovernanceActionDefinition } from './governance-action-registry';

export interface GovernanceAuditMetadata {
  governanceDomain: GovernanceDomainCode;
  governanceActionType: GovernanceActionType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  permissionUsed: string;
  actorUserId: string;
  tenantId: string | null;
  requestId: string;
  changedKeys?: string[];
  before?: any;
  after?: any;
  escalation?: {
    type: GovernanceEscalationType;
    reason: string;
  };
}

export type GovernanceEscalationType =
  | 'SUPER_ADMIN_GLOBAL'
  | 'GLOBAL_GOVERNANCE_OVERRIDE'
  | 'MODULE_OVERRIDE'
  | 'PERIOD_SOFT_CLOSE_POST_OVERRIDE'
  | 'RETRO_POSTING_OVERRIDE'
  | 'PERIOD_REOPEN'
  | 'OTHER';

function strictModeEnabled() {
  return process.env.GOVERNANCE_STRICT_MODE === 'true';
}

export function getRequestIdOrUnknown(req?: Request): string {
  const requestId = typeof (req as any)?.requestId === 'string' ? (req as any).requestId : null;
  return requestId && requestId.trim() ? requestId.trim() : 'UNKNOWN_REQUEST';
}

export function assertGovernanceMetadataComplete(meta: Partial<GovernanceAuditMetadata>, label: string) {
  const missing: string[] = [];
  const must = (k: keyof GovernanceAuditMetadata) => {
    const v = (meta as any)?.[k];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) missing.push(String(k));
  };

  must('governanceDomain');
  must('governanceActionType');
  must('severity');
  must('permissionUsed');
  must('actorUserId');
  must('requestId');
  // tenantId may be null for global events; validate only presence of key.
  if (!('tenantId' in meta)) missing.push('tenantId');

  if (missing.length === 0) return;

  const msg = `Governance audit metadata incomplete (${label}): missing ${missing.join(', ')}`;
  if (strictModeEnabled()) {
    throw new BadRequestException(msg);
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}

export function buildGovernanceAuditMetadata(params: {
  actionType: GovernanceActionType;
  permissionUsed: string;
  actorUserId: string;
  tenantId: string | null;
  req?: Request;
  changedKeys?: string[];
  before?: any;
  after?: any;
  escalation?: { type: GovernanceEscalationType; reason: string };
}): GovernanceAuditMetadata {
  const def = getGovernanceActionDefinition(params.actionType);
  if (!def) {
    throw new BadRequestException(`Unknown governance actionType: ${params.actionType}`);
  }

  const meta: GovernanceAuditMetadata = {
    governanceDomain: def.governanceDomain,
    governanceActionType: params.actionType,
    severity: params.escalation ? 'CRITICAL' : def.severity,
    permissionUsed: params.permissionUsed,
    actorUserId: params.actorUserId,
    tenantId: params.tenantId,
    requestId: getRequestIdOrUnknown(params.req),
    ...(params.changedKeys ? { changedKeys: params.changedKeys } : {}),
    ...(params.before !== undefined ? { before: params.before } : {}),
    ...(params.after !== undefined ? { after: params.after } : {}),
    ...(params.escalation ? { escalation: params.escalation } : {}),
  };

  assertGovernanceMetadataComplete(meta, params.actionType);
  return meta;
}

export function maybeBuildGovernanceOverrideAuditMetadata(params: {
  req: Request;
  permissionUsed: string;
  actorUserId: string;
  tenantId: string | null;
  changedKeys?: string[];
  before?: any;
  after?: any;
}): GovernanceAuditMetadata | null {
  const escalation = (params.req as any)?.governanceEscalation as
    | { type?: GovernanceEscalationType; reason?: string }
    | undefined;
  const type = escalation?.type;
  const reason = typeof escalation?.reason === 'string' ? escalation?.reason : '';
  if (!type) return null;
  if (!reason.trim()) return null;

  const actionType: GovernanceActionType | null =
    type === 'PERIOD_SOFT_CLOSE_POST_OVERRIDE'
      ? 'PERIOD_SOFT_CLOSE_POST_OVERRIDE'
      : type === 'RETRO_POSTING_OVERRIDE'
        ? 'RETRO_POSTING_OVERRIDE'
        : type === 'PERIOD_REOPEN'
          ? 'PERIOD_REOPEN'
          : null;

  if (!actionType) return null;

  return buildGovernanceAuditMetadata({
    actionType,
    permissionUsed: params.permissionUsed,
    actorUserId: params.actorUserId,
    tenantId: params.tenantId,
    req: params.req,
    ...(params.changedKeys ? { changedKeys: params.changedKeys } : {}),
    ...(params.before !== undefined ? { before: params.before } : {}),
    ...(params.after !== undefined ? { after: params.after } : {}),
    escalation: { type, reason },
  });
}

export function assertNoCrossDomainMutation(params: {
  actionType: GovernanceActionType;
  domainsTouched: GovernanceDomainCode[];
}) {
  const uniq = Array.from(new Set(params.domainsTouched));
  if (uniq.length <= 1) return;

  const msg = `Cross-domain mutation blocked (${params.actionType}): ${uniq.join(', ')}`;
  if (strictModeEnabled()) {
    throw new BadRequestException(msg);
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}

export function detectGovernanceDomainsFromPayload(params: {
  payload: any;
  keyToDomain: Record<string, GovernanceDomainCode>;
}): GovernanceDomainCode[] {
  const keys = Object.keys(params.payload ?? {}).filter(
    (k) => (params.payload as any)?.[k] !== undefined,
  );

  const domains: GovernanceDomainCode[] = [];
  for (const k of keys) {
    const d = params.keyToDomain[k];
    if (d) domains.push(d);
  }
  return Array.from(new Set(domains));
}
