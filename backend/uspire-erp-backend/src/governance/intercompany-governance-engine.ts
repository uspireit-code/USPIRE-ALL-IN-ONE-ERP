import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

import { buildGovernanceAuditMetadata } from './governance-enforcement';
import type { GovernanceActionType } from './governance-action-registry';

import {
  INTERCOMPANY_GOVERNANCE_REGISTRY,
  type IntercompanyGovernanceRuleCode,
  type IntercompanyGovernanceRuleDefinition,
} from './intercompany-governance-registry';

export type IntercompanyGovernanceMode =
  | 'CREATE_DRAFT'
  | 'UPDATE_DRAFT'
  | 'UPLOAD'
  | 'POST'
  | 'REVERSE'
  | 'OTHER';

export type IntercompanyAccountMeta = {
  accountId: string;
  accountCode?: string | null;
  isIntercompanyAccount?: boolean | null;
  intercompanyEnabled?: boolean | null;
  intercompanyRole?: 'DUE_TO' | 'DUE_FROM' | 'INTERCOMPANY_CLEARING' | null;
};

export type IntercompanyLineContext = {
  lineNumber?: number | null;
  legalEntityId?: string | null;
  debit?: number | null;
  credit?: number | null;
  account: IntercompanyAccountMeta;
};

export type ActorLegalEntityAccessContext = {
  legalEntityId: string;
  accessLevel?: string | null;
  canPost?: boolean | null;
  canApprove?: boolean | null;
  canOverride?: boolean | null;
  expiresAt?: Date | string | null;
};

export type IntercompanyGovernanceContext = {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  permissionUsed: string;

  mode: IntercompanyGovernanceMode;

  entityType: string;
  entityId: string;

  journalType?: string | null;
  reference?: string | null;

  governanceActions: GovernanceActionType[];

  escalation?: { type?: string; reason?: string } | null;
  justificationText?: string | null;

  actorLegalEntityAccess?: ActorLegalEntityAccessContext[] | null;

  lines: IntercompanyLineContext[];
};

function computeEliminationReadyMetadata(ctx: IntercompanyGovernanceContext): {
  reference: string | null;
  reconciliationKey: string | null;
  distinctLegalEntityIds: string[];
  hasDueTo: boolean;
  hasDueFrom: boolean;
} {
  const distinctLegalEntityIds = Array.from(
    new Set(
      (ctx.lines ?? []).map((l) => String(l.legalEntityId ?? '').trim()).filter(Boolean),
    ),
  ).sort();

  const ref = String(ctx.reference ?? '').trim();
  const reconciliationKey = ref.length >= 6 ? ref : null;

  const roles = new Set(
    (ctx.lines ?? [])
      .map((l) => String(l.account?.intercompanyRole ?? '').trim())
      .filter(Boolean),
  );

  return {
    reference: ref || null,
    reconciliationKey,
    distinctLegalEntityIds,
    hasDueTo: roles.has('DUE_TO'),
    hasDueFrom: roles.has('DUE_FROM'),
  };
}

function ruleApplies(params: {
  ctx: IntercompanyGovernanceContext;
  rule: IntercompanyGovernanceRuleDefinition;
}): boolean {
  const { ctx, rule } = params;

  if (rule.applicableGovernanceActions !== 'ANY') {
    const has = ctx.governanceActions.some((a) =>
      rule.applicableGovernanceActions.includes(a),
    );
    if (!has) return false;
  }

  if (rule.applicableJournalTypes !== 'ANY') {
    const jt = String(ctx.journalType ?? '').trim().toUpperCase();
    if (!jt) return false;
    const allowed = rule.applicableJournalTypes.map((x) => String(x));
    if (!allowed.includes(jt as any)) return false;
  }

  return true;
}

function throwIntercompanyViolation(params: {
  actionType: GovernanceActionType;
  message: string;
  ctx: IntercompanyGovernanceContext;
  ruleCode?: IntercompanyGovernanceRuleCode;
  details?: any;
}): never {
  const meta = buildGovernanceAuditMetadata({
    actionType: params.actionType,
    permissionUsed: params.ctx.permissionUsed,
    actorUserId: params.ctx.actorUserId,
    tenantId: params.ctx.tenantId,
    req: params.ctx.req,
    after: {
      mode: params.ctx.mode,
      entityType: params.ctx.entityType,
      entityId: params.ctx.entityId,
      journalType: params.ctx.journalType ?? null,
      reference: params.ctx.reference ?? null,
      governanceActions: params.ctx.governanceActions,
      escalation: params.ctx.escalation ?? null,
      ruleCode: params.ruleCode ?? null,
      lineCount: params.ctx.lines.length,
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'INTERCOMPANY_GOVERNANCE_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

function amountNet(line: IntercompanyLineContext): number {
  const d = Number(line.debit ?? 0);
  const c = Number(line.credit ?? 0);
  return d - c;
}

function round2(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function isExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function isPostingMode(mode: IntercompanyGovernanceMode): boolean {
  return mode === 'POST' || mode === 'REVERSE';
}

export function assertIntercompanyGovernance(ctx: IntercompanyGovernanceContext): {
  appliedRules: IntercompanyGovernanceRuleCode[];
  eliminationReady?: {
    reference: string | null;
    reconciliationKey: string | null;
    distinctLegalEntityIds: string[];
    hasDueTo: boolean;
    hasDueFrom: boolean;
  };
} {
  const appliedRules: IntercompanyGovernanceRuleCode[] = [];

  for (const rule of Object.values(INTERCOMPANY_GOVERNANCE_REGISTRY)) {
    if (!ruleApplies({ ctx, rule })) continue;
    appliedRules.push(rule.ruleCode);

    if (rule.ruleCode === 'ENTITY_PAIR_REQUIRED') {
      const entityIds = new Set(
        (ctx.lines ?? []).map((l) => l.legalEntityId).filter(Boolean) as string[],
      );
      const anyMissingEntity = (ctx.lines ?? []).some((l) => !l.legalEntityId);
      if (anyMissingEntity || entityIds.size < 2) {
        throwIntercompanyViolation({
          actionType: 'INTERCOMPANY_BALANCE_VIOLATION',
          message:
            'Intercompany activity requires at least two distinct legal entities and every line must be tagged with legalEntityId',
          ctx,
          ruleCode: rule.ruleCode,
          details: {
            distinctLegalEntities: entityIds.size,
            anyMissingLegalEntity: anyMissingEntity,
          },
        });
      }
    }

    if (rule.ruleCode === 'LEGAL_ENTITY_SCOPE_REQUIRED') {
      const usedEntityIds = new Set(
        (ctx.lines ?? []).map((l) => l.legalEntityId).filter(Boolean) as string[],
      );

      if (usedEntityIds.size === 0) {
        // No legal entity tags -> other rules will handle missing entity tags.
        continue;
      }

      const accessList = (ctx.actorLegalEntityAccess ?? [])
        .filter((a) => a && a.legalEntityId)
        .filter((a) => !isExpired(a.expiresAt));

      const allowed = new Set(accessList.map((a) => String(a.legalEntityId)));

      const missing = Array.from(usedEntityIds).filter((le) => !allowed.has(le));

      const insufficientPostAuthority = isPostingMode(ctx.mode)
        ? Array.from(usedEntityIds).filter((le) => {
            const row = accessList.find((a) => String(a.legalEntityId) === le);
            return !row || !row.canPost;
          })
        : [];

      if (missing.length > 0) {
        const escalationAllowed = Boolean(ctx.escalation?.type);
        if (!escalationAllowed) {
          throwIntercompanyViolation({
            actionType: 'INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION',
            message:
              'Your user account is not authorized to transact in the selected legal entity. Please contact your Finance Administrator for access.',
            ctx,
            ruleCode: rule.ruleCode,
            details: {
              missingLegalEntityIds: missing,
              actorUserId: ctx.actorUserId,
              eliminationReady: computeEliminationReadyMetadata(ctx),
            },
          });
        }
      }

      if (insufficientPostAuthority.length > 0) {
        const escalationAllowed = Boolean(ctx.escalation?.type);
        if (!escalationAllowed) {
          throwIntercompanyViolation({
            actionType: 'INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION',
            message:
              'You do not have posting authority for one or more legal entities used in this journal. Contact your Finance Administrator.',
            ctx,
            ruleCode: rule.ruleCode,
            details: {
              missingPostAuthorityLegalEntityIds: insufficientPostAuthority,
              actorUserId: ctx.actorUserId,
              eliminationReady: computeEliminationReadyMetadata(ctx),
            },
          });
        }
      }
    }

    if (rule.ruleCode === 'ENTITY_LEVEL_BALANCE') {
      const byEntity = new Map<string, number>();
      for (const l of ctx.lines ?? []) {
        const le = String(l.legalEntityId ?? '').trim();
        if (!le) continue;
        byEntity.set(le, round2((byEntity.get(le) ?? 0) + amountNet(l)));
      }

      const imbalanced = Array.from(byEntity.entries())
        .map(([legalEntityId, net]) => ({ legalEntityId, net }))
        .filter((x) => Math.abs(x.net) >= 0.01);

      if (imbalanced.length > 0) {
        throwIntercompanyViolation({
          actionType: 'INTERCOMPANY_BALANCE_VIOLATION',
          message: 'Intercompany journals must balance by legal entity',
          ctx,
          ruleCode: rule.ruleCode,
          details: { imbalanced },
        });
      }
    }

    if (rule.ruleCode === 'DUE_TO_DUE_FROM_REQUIRED') {
      const dueToByEntity = new Map<string, number>();
      const dueFromByEntity = new Map<string, number>();

      for (const l of ctx.lines ?? []) {
        const le = String(l.legalEntityId ?? '').trim();
        if (!le) continue;
        const role = String(l.account?.intercompanyRole ?? '').trim();
        if (!role) continue;

        const enabled = Boolean(l.account?.intercompanyEnabled);
        const isIc = Boolean(l.account?.isIntercompanyAccount);
        if (!enabled || !isIc) continue;

        const net = amountNet(l);

        if (role === 'DUE_TO') {
          dueToByEntity.set(le, round2((dueToByEntity.get(le) ?? 0) + net));
        }
        if (role === 'DUE_FROM') {
          dueFromByEntity.set(le, round2((dueFromByEntity.get(le) ?? 0) + net));
        }
      }

      const entities = new Set<string>([
        ...Array.from(dueToByEntity.keys()),
        ...Array.from(dueFromByEntity.keys()),
      ]);

      if (entities.size === 0) {
        throwIntercompanyViolation({
          actionType: 'INTERCOMPANY_BALANCE_VIOLATION',
          message:
            'Intercompany journals must use due-to and due-from accounts configured via COA intercompany governance metadata',
          ctx,
          ruleCode: rule.ruleCode,
        });
      }

      const mismatches: Array<{ legalEntityId: string; dueToNet: number; dueFromNet: number }> = [];
      for (const le of entities) {
        const dueToNet = round2(dueToByEntity.get(le) ?? 0);
        const dueFromNet = round2(dueFromByEntity.get(le) ?? 0);
        if (Math.abs(dueToNet + dueFromNet) >= 0.01) {
          mismatches.push({ legalEntityId: le, dueToNet, dueFromNet });
        }
      }

      if (mismatches.length > 0) {
        throwIntercompanyViolation({
          actionType: 'INTERCOMPANY_BALANCE_VIOLATION',
          message: 'Due-to and due-from positions must be mirrored by entity',
          ctx,
          ruleCode: rule.ruleCode,
          details: { mismatches },
        });
      }
    }

    if (rule.ruleCode === 'ELIMINATION_REFERENCE_REQUIRED') {
      const ref = String(ctx.reference ?? '').trim();
      if (ref.length < 6) {
        throwIntercompanyViolation({
          actionType: 'INTERCOMPANY_ELIMINATION_REFERENCE_VIOLATION',
          message:
            'Intercompany journals require an elimination-ready reference (provide a stable reconciliation identifier)',
          ctx,
          ruleCode: rule.ruleCode,
          details: { eliminationReady: computeEliminationReadyMetadata(ctx) },
        });
      }
    }
  }

  return {
    appliedRules,
    eliminationReady: computeEliminationReadyMetadata(ctx),
  };
}
