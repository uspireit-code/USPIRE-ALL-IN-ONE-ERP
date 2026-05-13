import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import type { JournalEntry, JournalLine, JournalType } from '@prisma/client';

import { buildGovernanceAuditMetadata } from '../governance/governance-enforcement';
import type { GovernanceActionType } from '../governance/governance-action-registry';

import type {
  JournalPolicyTypeCode,
  JournalTypePolicyDefinition,
} from './journal-type-registry';
import { getJournalTypePolicy } from './journal-type-registry';

export type JournalTypePolicyAssertionMode =
  | 'CREATE_DRAFT'
  | 'UPDATE_DRAFT'
  | 'UPLOAD'
  | 'REVERSE'
  | 'POST';

export interface JournalTypePolicyContext {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  permissionUsed: string;

  mode: JournalTypePolicyAssertionMode;

  journalDate: Date;
  prismaJournalType: JournalType;

  periodType?: string | null;

  reversalOfId?: string | null;

  reference?: string | null;
  description?: string | null;

  sourceType?: string | null;
  sourceId?: string | null;

  lines: Array<{
    accountId: string;
    legalEntityId?: string | null;
    departmentId?: string | null;
    projectId?: string | null;
    fundId?: string | null;
  }>;
}

export function resolveJournalPolicyType(params: {
  prismaJournalType: JournalType;
  periodType?: string | null;
  reversalOfId?: string | null;
  reference?: string | null;
  sourceType?: string | null;
}): JournalPolicyTypeCode {
  if (params.periodType === 'OPENING') return 'OPENING_BALANCE_JOURNAL';

  if (params.prismaJournalType === 'REVERSING' || !!params.reversalOfId) {
    return 'REVERSAL_JOURNAL';
  }

  if (params.prismaJournalType === 'ACCRUAL') return 'ACCRUAL_JOURNAL';

  if (params.prismaJournalType === 'ADJUSTING') return 'ADJUSTMENT_JOURNAL';

  const sourceType = (params.sourceType ?? '').trim().toUpperCase();
  if (sourceType && sourceType !== 'GL') {
    return 'SYSTEM_GENERATED_JOURNAL';
  }

  return 'GENERAL_JOURNAL';
}

function requiredDimensionMissing(params: {
  dim: 'LEGAL_ENTITY' | 'DEPARTMENT' | 'PROJECT' | 'FUND';
  lines: JournalTypePolicyContext['lines'];
}): boolean {
  if (params.dim === 'LEGAL_ENTITY') {
    return params.lines.some((l) => !l.legalEntityId);
  }
  if (params.dim === 'DEPARTMENT') {
    return params.lines.some((l) => !l.departmentId);
  }
  if (params.dim === 'PROJECT') {
    return params.lines.some((l) => !l.projectId);
  }
  if (params.dim === 'FUND') {
    return params.lines.some((l) => !l.fundId);
  }
  return false;
}

function throwPolicyViolation(params: {
  actionType: GovernanceActionType;
  message: string;
  ctx: JournalTypePolicyContext;
  policyCode: JournalPolicyTypeCode;
  policy: JournalTypePolicyDefinition;
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
      journalDate: params.ctx.journalDate?.toISOString?.() ?? null,
      prismaJournalType: params.ctx.prismaJournalType,
      policyType: params.policyCode,
      policySensitivity: params.policy.governanceSensitivity,
      periodType: params.ctx.periodType ?? null,
      reversalOfId: params.ctx.reversalOfId ?? null,
      reference: params.ctx.reference ?? null,
      sourceType: params.ctx.sourceType ?? null,
      sourceId: params.ctx.sourceId ?? null,
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'JOURNAL_TYPE_POLICY_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

export function assertJournalTypePolicy(ctx: JournalTypePolicyContext): {
  policyType: JournalPolicyTypeCode;
  policy: JournalTypePolicyDefinition;
} {
  const policyType = resolveJournalPolicyType({
    prismaJournalType: ctx.prismaJournalType,
    periodType: ctx.periodType,
    reversalOfId: ctx.reversalOfId,
    reference: ctx.reference,
    sourceType: ctx.sourceType,
  });

  const policy = getJournalTypePolicy(policyType);

  if (policyType === 'REVERSAL_JOURNAL') {
    if (!ctx.reversalOfId) {
      throwPolicyViolation({
        actionType: 'JOURNAL_TYPE_REVERSAL_POLICY_VIOLATION',
        message: 'Reversal journal must reference an original journal',
        ctx,
        policyCode: policyType,
        policy,
      });
    }

    if (ctx.prismaJournalType !== 'REVERSING') {
      throwPolicyViolation({
        actionType: 'JOURNAL_TYPE_REVERSAL_POLICY_VIOLATION',
        message: 'Reversal journal must use journalType REVERSING',
        ctx,
        policyCode: policyType,
        policy,
      });
    }
  }

  if (policy.postingRules && ctx.periodType === 'OPENING') {
    if (!policy.postingRules.allowsInOpeningPeriod) {
      throwPolicyViolation({
        actionType: 'JOURNAL_TYPE_OPENING_BALANCE_POLICY_VIOLATION',
        message: 'This journal type is not allowed in the Opening Balances period',
        ctx,
        policyCode: policyType,
        policy,
      });
    }
  }

  for (const dim of policy.requiredDimensions) {
    const missing = requiredDimensionMissing({
      dim,
      lines: ctx.lines,
    });
    if (missing) {
      throwPolicyViolation({
        actionType: 'JOURNAL_TYPE_MISSING_REQUIRED_DIMENSION',
        message: `Missing required dimension: ${dim}`,
        ctx,
        policyCode: policyType,
        policy,
        details: { missingDimension: dim },
      });
    }
  }

  if (policy.requiredEvidence?.required) {
  }

  if (policyType === 'SYSTEM_GENERATED_JOURNAL') {
    if (ctx.mode === 'UPLOAD') {
      throwPolicyViolation({
        actionType: 'JOURNAL_TYPE_INVALID_SOURCE',
        message:
          'Upload cannot create system-generated journals. Select a GL journal type.',
        ctx,
        policyCode: policyType,
        policy,
      });
    }
  }

  return { policyType, policy };
}

export function buildJournalTypePolicyContextFromEntry(params: {
  req?: Request;
  entry: Pick<JournalEntry, 'tenantId' | 'journalDate' | 'journalType' | 'reversalOfId' | 'reference' | 'description' | 'sourceType' | 'sourceId'>;
  lines: Array<Pick<JournalLine, 'accountId' | 'legalEntityId' | 'departmentId'> & { projectId?: string | null; fundId?: string | null }>;
  permissionUsed: string;
  actorUserId: string;
  mode: JournalTypePolicyAssertionMode;
  periodType?: string | null;
}): JournalTypePolicyContext {
  return {
    req: params.req,
    tenantId: params.entry.tenantId,
    actorUserId: params.actorUserId,
    permissionUsed: params.permissionUsed,
    mode: params.mode,
    journalDate: params.entry.journalDate,
    prismaJournalType: params.entry.journalType,
    periodType: params.periodType,
    reversalOfId: params.entry.reversalOfId,
    reference: params.entry.reference,
    description: params.entry.description,
    sourceType: params.entry.sourceType,
    sourceId: params.entry.sourceId,
    lines: params.lines.map((l) => ({
      accountId: l.accountId,
      legalEntityId: (l as any).legalEntityId ?? null,
      departmentId: (l as any).departmentId ?? null,
      projectId: (l as any).projectId ?? null,
      fundId: (l as any).fundId ?? null,
    })),
  };
}
