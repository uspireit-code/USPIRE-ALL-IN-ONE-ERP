import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuditEntityType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { evaluateSoD, type SoDCheckContext } from '../rbac/sod-policy';

@Injectable()
export class SoDService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoLifecycleConflict(params: {
    req: Request;
    tenantId: string;
    realUserId: string;
    actingAsUserId?: string;
    delegationId?: string;
    actionType: 'APPROVE' | 'POST' | 'REVIEW' | 'VOID' | 'REJECT' | 'RETURN_TO_REVIEW' | 'REVERSE' | 'PERIOD_CORRECT';
    soDAction: string;
    entityType: AuditEntityType;
    entityId: string;
    createdByUserId?: string;
    approvedByUserId?: string;
    reviewedByUserId?: string;
    postedByUserId?: string;
    submittedByUserId?: string;
    reversalInitiatedByUserId?: string;
    checklistCompletedByIds?: string[];
    allowSelfPosting?: boolean;
    permissionUsed?: string;
  }): Promise<void> {
    const ctx: SoDCheckContext = {
      action: params.soDAction,
      actorUserId: params.realUserId,
      entityType: params.entityType,
      entityId: params.entityId,
      createdById: params.createdByUserId,
      approvedById: params.approvedByUserId,
      reviewedById: params.reviewedByUserId,
      postedById: params.postedByUserId,
      submittedById: params.submittedByUserId,
      reversalInitiatedById: params.reversalInitiatedByUserId,
      checklistCompletedByIds: params.checklistCompletedByIds,
      allowSelfPosting: params.allowSelfPosting,
    };

    const res = evaluateSoD(ctx);
    if (res.allowed) return;

    const isMakerCheckerConflict =
      (params.actionType === 'APPROVE' || params.actionType === 'POST') &&
      !!params.createdByUserId &&
      String(params.createdByUserId) === String(params.realUserId);

    const reasonCode = isMakerCheckerConflict
      ? 'MAKER_CHECKER_CONFLICT'
      : 'LIFECYCLE_CONFLICT';

    const message = isMakerCheckerConflict
      ? 'You cannot approve or post a transaction you initiated.'
      : 'You cannot perform this action because you already participated in this transaction workflow.';

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'DELEGATION_ACTION_BLOCKED_SOD' as any,
        actorUserId: params.realUserId,
        entityType: params.entityType,
        entityId: params.entityId,
        timestamp: new Date(),
        ipAddress: (params.req as any)?.ip ?? null,
        userAgent: (params.req as any)?.headers?.['user-agent'] ?? null,
        requestId: (params.req as any)?.headers?.['x-request-id'] ?? null,
        permissionUsed: params.permissionUsed,
        outcome: 'BLOCKED' as any,
        reason: reasonCode,
        action: params.actionType,
        metadata: {
          reasonCode,
          ruleCode: res.ruleCode,
          soDAction: params.soDAction,
          actionType: params.actionType,
          delegationId: params.delegationId ?? null,
          actingAsUserId: params.actingAsUserId ?? null,
          realUserId: params.realUserId,
          entityType: params.entityType,
          entityId: params.entityId,
        },
      },
      this.prisma,
    );

    throw new ForbiddenException(message);
  }
}
