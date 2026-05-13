import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuditEvidence } from '@prisma/client';

import { buildGovernanceAuditMetadata } from './governance-enforcement';
import type { GovernanceActionType } from './governance-action-registry';

import {
  EVIDENCE_GOVERNANCE_REGISTRY,
  type EvidenceAttachmentType,
  type EvidenceGovernanceRuleCode,
  type EvidenceGovernanceRuleDefinition,
} from './evidence-governance-registry';

export type EvidenceGovernanceMode =
  | 'JOURNAL_POST'
  | 'JOURNAL_POST_OVERRIDE'
  | 'PERIOD_REOPEN'
  | 'UPLOAD'
  | 'OTHER';

export type EvidenceGovernanceContext = {
  req?: Request;
  tenantId: string;
  actorUserId: string;
  permissionUsed: string;

  mode: EvidenceGovernanceMode;

  entityType: string;
  entityId: string;

  journalType?: string | null;

  governanceActions: GovernanceActionType[];

  escalation?: { type?: string; reason?: string } | null;

  justificationText?: string | null;

  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string | null;
    size: number;
    evidenceCategory?: string | null;
  }>;
};

function mapMimeToAttachmentType(mimeType: string | null | undefined): EvidenceAttachmentType {
  const mt = String(mimeType ?? '').trim().toLowerCase();
  if (!mt) return 'OTHER';
  if (mt === 'application/pdf') return 'PDF';
  if (mt.startsWith('image/')) return 'IMAGE';
  if (
    mt.includes('spreadsheet') ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel'
  ) {
    return 'SPREADSHEET';
  }
  if (mt === 'text/csv' || mt.includes('csv')) return 'CSV';
  if (mt.startsWith('text/')) return 'TEXT';
  return 'OTHER';
}

function ruleApplies(params: {
  rule: EvidenceGovernanceRuleDefinition;
  ctx: EvidenceGovernanceContext;
}): boolean {
  const { rule, ctx } = params;

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

function throwEvidenceViolation(params: {
  actionType: GovernanceActionType;
  message: string;
  ctx: EvidenceGovernanceContext;
  ruleCode?: EvidenceGovernanceRuleCode;
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
      governanceActions: params.ctx.governanceActions,
      escalation: params.ctx.escalation ?? null,
      ruleCode: params.ruleCode ?? null,
      attachmentCount: params.ctx.attachments.length,
      ...(params.details ? { details: params.details } : {}),
    },
  });

  throw new BadRequestException({
    code: 'EVIDENCE_GOVERNANCE_VIOLATION',
    message: params.message,
    governance: meta,
  });
}

export function assertEvidenceGovernance(ctx: EvidenceGovernanceContext): {
  appliedRules: EvidenceGovernanceRuleCode[];
} {
  const appliedRules: EvidenceGovernanceRuleCode[] = [];

  const justification = String(ctx.justificationText ?? '').trim();

  for (const rule of Object.values(EVIDENCE_GOVERNANCE_REGISTRY)) {
    if (!ruleApplies({ rule, ctx })) continue;

    appliedRules.push(rule.ruleCode);

    if (rule.requiredJustification && justification.length < 3) {
      throwEvidenceViolation({
        actionType: 'GOVERNANCE_JUSTIFICATION_REQUIRED',
        message: 'Governance justification is required for this action',
        ctx,
        ruleCode: rule.ruleCode,
      });
    }

    if (rule.escalationRequired) {
      const hasReason = String(ctx.escalation?.reason ?? '').trim().length >= 3;
      if (!hasReason) {
        throwEvidenceViolation({
          actionType: 'GOVERNANCE_JUSTIFICATION_REQUIRED',
          message: 'Escalation reason is required for this action',
          ctx,
          ruleCode: rule.ruleCode,
        });
      }
    }

    if (rule.requiredEvidence) {
      if ((ctx.attachments ?? []).length < Math.max(0, rule.minimumAttachmentCount)) {
        throwEvidenceViolation({
          actionType: 'MISSING_SUPPORT_DOCUMENT',
          message: 'Supporting evidence is required for this action',
          ctx,
          ruleCode: rule.ruleCode,
          details: {
            minimumAttachmentCount: rule.minimumAttachmentCount,
            evidenceCategory: rule.evidenceCategory,
          },
        });
      }

      if (rule.requireEvidenceCategoryMetadata) {
        const matching = (ctx.attachments ?? []).some(
          (a) =>
            String((a as any).evidenceCategory ?? '').trim() ===
            String(rule.evidenceCategory),
        );
        if (!matching) {
          throwEvidenceViolation({
            actionType: 'MISSING_SUPPORT_DOCUMENT',
            message:
              'Supporting evidence must be tagged with the required evidence category for this governed action',
            ctx,
            ruleCode: rule.ruleCode,
            details: {
              requiredEvidenceCategory: rule.evidenceCategory,
            },
          });
        }
      }

      const hasCategoryMetadata = (ctx.attachments ?? []).some(
        (a) => String((a as any).evidenceCategory ?? '').trim().length > 0,
      );
      if (hasCategoryMetadata) {
        const ok = (ctx.attachments ?? []).some(
          (a) =>
            String((a as any).evidenceCategory ?? '').trim() ===
            String(rule.evidenceCategory),
        );
        if (!ok) {
          throwEvidenceViolation({
            actionType: 'MISSING_SUPPORT_DOCUMENT',
            message: 'Supporting evidence category is missing for this governed action',
            ctx,
            ruleCode: rule.ruleCode,
            details: {
              requiredEvidenceCategory: rule.evidenceCategory,
            },
          });
        }
      }

      if (rule.allowedAttachmentTypes !== 'ANY') {
        const invalid = (ctx.attachments ?? [])
          .map((a) => ({
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            type: mapMimeToAttachmentType(a.mimeType),
          }))
          .filter((x) => !rule.allowedAttachmentTypes.includes(x.type));

        if (invalid.length > 0) {
          throwEvidenceViolation({
            actionType: 'INVALID_ATTACHMENT_TYPE',
            message: 'One or more attachments have an invalid type for this governed action',
            ctx,
            ruleCode: rule.ruleCode,
            details: {
              allowedAttachmentTypes: rule.allowedAttachmentTypes,
              invalid,
            },
          });
        }
      }
    }
  }

  return { appliedRules };
}
