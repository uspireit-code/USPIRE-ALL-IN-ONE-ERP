import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditEntityType, AuditEventType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { buildGovernanceAuditMetadata } from './governance-enforcement';
import {
  assertAutomationGovernance,
  type AutomationActorType,
} from './automation-governance-engine';

export type AutomationExecutionStatus =
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'SUSPENDED'
  | 'CANCELLED';

@Injectable()
export class GovernanceAutomationExecutionSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async startExecution(params: {
    tenantId: string;
    automationCode: string;
    scheduleId?: string | null;

    actorType: AutomationActorType;
    actorUserId?: string | null;

    permissionUsed: string;
    req?: any;

    journalType?: string | null;
    legalEntityIdsTouched?: string[];

    evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;

    escalation?: { type?: string; reason?: string } | null;

    overrideSessionId?: string | null;
    overrideCodesUsed?: string[];

    retryCount?: number;
    lastExecutionAt?: Date | string | null;
    isSuspended?: boolean;
  }) {
    const automationCode = String(params.automationCode ?? '').trim();
    if (!automationCode) throw new BadRequestException('automationCode is required');

    // Validate governance upfront (declarative, non-bypassable)
    assertAutomationGovernance({
      req: params.req,
      tenantId: params.tenantId,
      actorUserId: String(params.actorUserId ?? ''),
      actorType: params.actorType,
      permissionUsed: params.permissionUsed,
      automationCode: automationCode as any,
      journalType: params.journalType ?? null,
      legalEntityIdsTouched: params.legalEntityIdsTouched,
      evidenceRefs: params.evidenceRefs,
      escalation: params.escalation ?? null,
      overrideSessionId: params.overrideSessionId ?? null,
      overrideCodesUsed: params.overrideCodesUsed,
      retryCount: params.retryCount,
      lastExecutionAt: params.lastExecutionAt,
      isSuspended: params.isSuspended,
    });

    const created = await (this.prisma as any).governanceAutomationExecutionSession.create({
      data: {
        tenantId: params.tenantId,
        automationCode,
        scheduleId: params.scheduleId ? String(params.scheduleId) : null,
        executionStatus: 'STARTED',
        actorType: String(params.actorType),
        actorUserId: params.actorUserId ? String(params.actorUserId) : null,
        overrideSessionId: params.overrideSessionId ? String(params.overrideSessionId) : null,
        escalationType: params.escalation?.type ? String(params.escalation.type) : null,
        escalationReason: params.escalation?.reason ? String(params.escalation.reason) : null,
        evidenceMetadata: params.evidenceRefs ? (params.evidenceRefs as any) : null,
        governanceMetadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'AUTOMATION_EXECUTION_STARTED' as any,
            permissionUsed: params.permissionUsed,
            actorUserId: String(params.actorUserId ?? ''),
            tenantId: params.tenantId,
            req: params.req,
            after: {
              automationCode,
              scheduleId: params.scheduleId ?? null,
              actorType: params.actorType,
              overrideSessionId: params.overrideSessionId ?? null,
              retryCount: params.retryCount ?? 0,
            },
          }),
        } as any,
        retryCount: Math.max(0, Math.floor(Number(params.retryCount ?? 0))),
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_EXECUTION_STARTED' as AuditEventType,
        actorUserId: params.actorUserId ? String(params.actorUserId) : null,
        entityType: 'GOVERNANCE_AUTOMATION_EXECUTION_SESSION' as AuditEntityType,
        entityId: created.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'AUTOMATION_EXECUTION_STARTED' as any,
            permissionUsed: params.permissionUsed,
            actorUserId: String(params.actorUserId ?? ''),
            tenantId: params.tenantId,
            req: params.req,
            after: {
              automationCode,
              scheduleId: params.scheduleId ?? null,
              actorType: params.actorType,
              overrideSessionId: params.overrideSessionId ?? null,
              retryCount: params.retryCount ?? 0,
            },
          }),
        },
      },
      this.prisma,
    );

    if (params.overrideSessionId) {
      await writeAuditEventWithPrisma(
        {
          tenantId: params.tenantId,
          eventType: 'AUTOMATION_OVERRIDE_USED' as AuditEventType,
          actorUserId: params.actorUserId ? String(params.actorUserId) : null,
          entityType: 'GOVERNANCE_AUTOMATION_EXECUTION_SESSION' as AuditEntityType,
          entityId: created.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          permissionUsed: params.permissionUsed,
          metadata: {
            overrideSessionId: params.overrideSessionId,
            overrideCodesUsed: params.overrideCodesUsed ?? [],
          },
        },
        this.prisma,
      );
    }

    return created;
  }

  async completeExecution(params: {
    tenantId: string;
    executionId: string;
    completedById?: string | null;
    req?: any;
    permissionUsed: string;
    executionResult?: any;
  }) {
    const row = await this.getExecution({ tenantId: params.tenantId, executionId: params.executionId });

    const updated = await (this.prisma as any).governanceAutomationExecutionSession.update({
      where: { id: row.id },
      data: {
        executionStatus: 'COMPLETED',
        completedAt: new Date(),
        executionResult: params.executionResult ?? null,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_EXECUTION_COMPLETED' as AuditEventType,
        actorUserId: params.completedById ? String(params.completedById) : null,
        entityType: 'GOVERNANCE_AUTOMATION_EXECUTION_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async failExecution(params: {
    tenantId: string;
    executionId: string;
    failedById?: string | null;
    req?: any;
    permissionUsed: string;
    failureReason: string;
    executionResult?: any;
  }) {
    const row = await this.getExecution({ tenantId: params.tenantId, executionId: params.executionId });

    const updated = await (this.prisma as any).governanceAutomationExecutionSession.update({
      where: { id: row.id },
      data: {
        executionStatus: 'FAILED',
        completedAt: new Date(),
        failureReason: String(params.failureReason ?? '').trim() || 'automation_failed',
        executionResult: params.executionResult ?? null,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_EXECUTION_FAILED' as AuditEventType,
        actorUserId: params.failedById ? String(params.failedById) : null,
        entityType: 'GOVERNANCE_AUTOMATION_EXECUTION_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'FAILED' as any,
        permissionUsed: params.permissionUsed,
        reason: params.failureReason,
      },
      this.prisma,
    );

    return updated;
  }

  async getExecution(params: { tenantId: string; executionId: string }) {
    const row = await (this.prisma as any).governanceAutomationExecutionSession.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.executionId,
      },
    });
    if (!row) throw new NotFoundException('Automation execution not found');
    return row;
  }

  async listExecutions(params: {
    tenantId: string;
    automationCode?: string;
    scheduleId?: string;
    executionStatus?: string;
  }) {
    const where: any = {
      tenantId: params.tenantId,
    };
    if (params.automationCode) where.automationCode = String(params.automationCode);
    if (params.scheduleId) where.scheduleId = String(params.scheduleId);
    if (params.executionStatus) where.executionStatus = String(params.executionStatus);

    return (this.prisma as any).governanceAutomationExecutionSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
  }
}
