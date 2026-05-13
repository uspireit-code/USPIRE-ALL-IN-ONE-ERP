import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import type { JournalType } from '@prisma/client';

import { buildGovernanceAuditMetadata } from '../governance/governance-enforcement';
import type { GovernanceActionType } from '../governance/governance-action-registry';
import type { GovernanceSeverity } from '../governance/governance-severity';

import {
  type CombinationGovernanceModuleCode,
  type CombinationGovernanceRuleCode,
  type CombinationGovernanceRuleDefinition,
  COMBINATION_GOVERNANCE_REGISTRY,
} from './combination-governance-registry';
import { resolveJournalPolicyType } from './journal-type-policy-engine';

export type CombinationGovernanceAssertionMode =
  | 'CREATE_DRAFT'
  | 'UPDATE_DRAFT'
  | 'UPLOAD'
  | 'REVERSE'
  | 'POST';

export type CombinationGovernanceLineContext = {
  lineNumber?: number | null;
  accountId: string;
  accountCode?: string | null;
  accountType?: string | null;
  isControlAccount?: boolean | null;
  isCashEquivalent?: boolean | null;
  requiresDepartment?: boolean | null;
  requiresProject?: boolean | null;
  requiresFund?: boolean | null;

  debit?: number | null;
  credit?: number | null;

  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
};

export interface CombinationGovernanceContext {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  permissionUsed: string;

  mode: CombinationGovernanceAssertionMode;
  module: CombinationGovernanceModuleCode;

  journalDate: Date;
  prismaJournalType: JournalType;
  periodType?: string | null;
  reversalOfId?: string | null;

  reference?: string | null;
  description?: string | null;

  sourceType?: string | null;
  sourceId?: string | null;

  lines: CombinationGovernanceLineContext[];
}

function toBool(v: any): boolean {
  return Boolean(v);
}

function matchesWildcard(v: unknown, selector: unknown): boolean {
  if (selector === undefined) return true;
  if (selector === '*') {
    return v !== undefined && v !== null && String(v) !== '';
  }
  return v === selector;
}

function selectorMatchesLine(params: {
  line: CombinationGovernanceLineContext;
  selector: any;
}): boolean {
  const { line, selector } = params;

  if (selector.accountId !== undefined && line.accountId !== selector.accountId) {
    return false;
  }
  if (
    selector.accountCode !== undefined &&
    String(line.accountCode ?? '') !== String(selector.accountCode)
  ) {
    return false;
  }
  if (
    selector.accountType !== undefined &&
    String(line.accountType ?? '') !== String(selector.accountType)
  ) {
    return false;
  }
  if (
    selector.isControlAccount !== undefined &&
    toBool(line.isControlAccount) !== toBool(selector.isControlAccount)
  ) {
    return false;
  }
  if (
    selector.isCashEquivalent !== undefined &&
    toBool(line.isCashEquivalent) !== toBool(selector.isCashEquivalent)
  ) {
    return false;
  }

  if (!matchesWildcard(line.legalEntityId ?? null, selector.legalEntityId)) {
    return false;
  }
  if (!matchesWildcard(line.departmentId ?? null, selector.departmentId)) {
    return false;
  }
  if (!matchesWildcard(line.projectId ?? null, selector.projectId)) {
    return false;
  }
  if (!matchesWildcard(line.fundId ?? null, selector.fundId)) {
    return false;
  }

  const debit = Number(line.debit ?? 0);
  const credit = Number(line.credit ?? 0);
  const side: 'DEBIT' | 'CREDIT' | 'ANY' = debit > 0 ? 'DEBIT' : credit > 0 ? 'CREDIT' : 'ANY';
  if (selector.side && selector.side !== 'ANY' && selector.side !== side) {
    return false;
  }

  return true;
}

function ruleApplies(params: {
  ctx: CombinationGovernanceContext;
  rule: CombinationGovernanceRuleDefinition;
}): boolean {
  const { ctx, rule } = params;

  if (rule.applicableModules !== 'ANY' && !rule.applicableModules.includes(ctx.module)) {
    return false;
  }

  if (rule.applicableJournalTypes !== 'ANY' && !rule.applicableJournalTypes.includes(ctx.prismaJournalType)) {
    return false;
  }

  const policyType = resolveJournalPolicyType({
    prismaJournalType: ctx.prismaJournalType,
    periodType: ctx.periodType,
    reversalOfId: ctx.reversalOfId,
    reference: ctx.reference,
    sourceType: ctx.sourceType,
  });

  if (
    rule.applicableJournalPolicyTypes !== 'ANY' &&
    !rule.applicableJournalPolicyTypes.includes(policyType as any)
  ) {
    return false;
  }

  return true;
}

function throwCombinationViolation(params: {
  actionType: GovernanceActionType;
  message: string;
  ctx: CombinationGovernanceContext;
  severity: GovernanceSeverity;
  ruleCode: CombinationGovernanceRuleCode;
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
      module: params.ctx.module,
      journalDate: params.ctx.journalDate?.toISOString?.() ?? null,
      prismaJournalType: params.ctx.prismaJournalType,
      periodType: params.ctx.periodType ?? null,
      reversalOfId: params.ctx.reversalOfId ?? null,
      reference: params.ctx.reference ?? null,
      sourceType: params.ctx.sourceType ?? null,
      sourceId: params.ctx.sourceId ?? null,
      severity: params.severity,
      ruleCode: params.ruleCode,
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'COMBINATION_GOVERNANCE_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

function getActionTypeForRule(ruleCode: CombinationGovernanceRuleCode): GovernanceActionType {
  if (ruleCode === 'RESTRICT_CONTROL_ACCOUNT_MANUAL_USE') {
    return 'RESTRICTED_CONTROL_ACCOUNT_USAGE';
  }
  if (ruleCode === 'FUND_REQUIRES_PROJECT') {
    return 'PROHIBITED_DIMENSION_PAIRING';
  }
  if (ruleCode === 'ACCOUNT_REQUIRES_DIMENSIONS') {
    return 'MISSING_REQUIRED_DIMENSION_COMBINATION';
  }
  if (ruleCode === 'INTERCOMPANY_ENTITY_PAIRING_REQUIRED') {
    return 'INTERCOMPANY_BALANCE_VIOLATION';
  }
  return 'INVALID_ACCOUNT_COMBINATION';
}

export function assertCombinationGovernance(ctx: CombinationGovernanceContext): {
  appliedRules: CombinationGovernanceRuleCode[];
} {
  const appliedRules: CombinationGovernanceRuleCode[] = [];

  for (const rule of Object.values(COMBINATION_GOVERNANCE_REGISTRY)) {
    if (!ruleApplies({ ctx, rule })) continue;
    appliedRules.push(rule.ruleCode);

    if (rule.ruleCode === 'RESTRICT_CONTROL_ACCOUNT_MANUAL_USE') {
      if (ctx.mode === 'CREATE_DRAFT' || ctx.mode === 'UPDATE_DRAFT' || ctx.mode === 'UPLOAD') {
        for (const line of ctx.lines) {
          if (toBool(line.isControlAccount)) {
            throwCombinationViolation({
              actionType: getActionTypeForRule(rule.ruleCode),
              message: 'Control accounts cannot be used in manual or upload-originated journals',
              ctx,
              severity: rule.severity,
              ruleCode: rule.ruleCode,
              details: {
                accountId: line.accountId,
                accountCode: line.accountCode ?? null,
                lineNumber: line.lineNumber ?? null,
              },
            });
          }
        }
      }
    }

    if (rule.ruleCode === 'INTERCOMPANY_ENTITY_PAIRING_REQUIRED') {
      const entityIds = new Set(
        ctx.lines.map((l) => l.legalEntityId).filter(Boolean) as string[],
      );
      const anyMissingEntity = ctx.lines.some((l) => !l.legalEntityId);
      if (anyMissingEntity || entityIds.size < 2) {
        throwCombinationViolation({
          actionType: getActionTypeForRule(rule.ruleCode),
          message:
            'Intercompany journals must include at least two distinct legal entities and every line must be tagged with legalEntityId',
          ctx,
          severity: rule.severity,
          ruleCode: rule.ruleCode,
          details: {
            distinctLegalEntities: entityIds.size,
            anyMissingLegalEntity: anyMissingEntity,
          },
        });
      }
    }

    if (rule.ruleCode === 'FUND_REQUIRES_PROJECT') {
      for (const line of ctx.lines) {
        if (line.fundId && !line.projectId) {
          throwCombinationViolation({
            actionType: getActionTypeForRule(rule.ruleCode),
            message: 'Fund requires Project',
            ctx,
            severity: rule.severity,
            ruleCode: rule.ruleCode,
            details: {
              accountId: line.accountId,
              accountCode: line.accountCode ?? null,
              lineNumber: line.lineNumber ?? null,
            },
          });
        }
      }
    }

    if (rule.ruleCode === 'ACCOUNT_REQUIRES_DIMENSIONS') {
      for (const line of ctx.lines) {
        const missing: string[] = [];

        if (toBool(line.requiresDepartment) && !line.departmentId) missing.push('DEPARTMENT');
        if (toBool(line.requiresProject) && !line.projectId) missing.push('PROJECT');
        if (toBool(line.requiresFund) && !line.fundId) missing.push('FUND');

        if (missing.length > 0) {
          throwCombinationViolation({
            actionType: getActionTypeForRule(rule.ruleCode),
            message: `Missing required dimension(s) for account: ${missing.join(', ')}`,
            ctx,
            severity: rule.severity,
            ruleCode: rule.ruleCode,
            details: {
              missing,
              accountId: line.accountId,
              accountCode: line.accountCode ?? null,
              lineNumber: line.lineNumber ?? null,
            },
          });
        }
      }
    }

    if (rule.prohibitedCombinations.length > 0) {
      for (const selector of rule.prohibitedCombinations) {
        for (const line of ctx.lines) {
          if (selectorMatchesLine({ line, selector })) {
            throwCombinationViolation({
              actionType: getActionTypeForRule(rule.ruleCode),
              message: `Prohibited combination detected (${rule.ruleCode})`,
              ctx,
              severity: rule.severity,
              ruleCode: rule.ruleCode,
              details: {
                selector,
                accountId: line.accountId,
                accountCode: line.accountCode ?? null,
                lineNumber: line.lineNumber ?? null,
              },
            });
          }
        }
      }
    }
  }

  return { appliedRules };
}
