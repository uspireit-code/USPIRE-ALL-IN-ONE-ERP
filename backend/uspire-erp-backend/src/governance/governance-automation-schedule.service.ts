import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditEntityType, AuditEventType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { buildGovernanceAuditMetadata } from './governance-enforcement';
import { getAutomationPolicy } from './automation-governance-registry';

export type AutomationScheduleStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'FAILED'
  | 'REVIEW_REQUIRED';

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isExpired(expiresAt: any, now: Date): boolean {
  const d = toDate(expiresAt);
  if (!d) return false;
  return d.getTime() <= now.getTime();
}

function computeNextRunAtMonthly(params: { lastRunAt: Date; dayOfMonth: number; hourUtc: number }): Date {
  const day = Math.max(1, Math.min(28, Math.floor(params.dayOfMonth)));
  const hour = Math.max(0, Math.min(23, Math.floor(params.hourUtc)));
  const y = params.lastRunAt.getUTCFullYear();
  const m = params.lastRunAt.getUTCMonth();
  const nextMonth = new Date(Date.UTC(y, m + 1, day, hour, 0, 0));
  return nextMonth;
}

function computeNextRunAtQuarterly(params: { lastRunAt: Date; dayOfMonth: number; hourUtc: number }): Date {
  const day = Math.max(1, Math.min(28, Math.floor(params.dayOfMonth)));
  const hour = Math.max(0, Math.min(23, Math.floor(params.hourUtc)));
  const y = params.lastRunAt.getUTCFullYear();
  const m = params.lastRunAt.getUTCMonth();
  const next = new Date(Date.UTC(y, m + 3, day, hour, 0, 0));
  return next;
}

function computeNextRunAtYearly(params: { lastRunAt: Date; monthUtc: number; dayOfMonth: number; hourUtc: number }): Date {
  const month = Math.max(0, Math.min(11, Math.floor(params.monthUtc)));
  const day = Math.max(1, Math.min(28, Math.floor(params.dayOfMonth)));
  const hour = Math.max(0, Math.min(23, Math.floor(params.hourUtc)));
  const y = params.lastRunAt.getUTCFullYear();
  return new Date(Date.UTC(y + 1, month, day, hour, 0, 0));
}

@Injectable()
export class GovernanceAutomationScheduleService {
  constructor(readonly prisma: PrismaService) {}

  computeNextRunAt(params: {
    schedule: any;
    automationCode: string;
    now: Date;
  }): Date | null {
    const config = (params.schedule as any)?.scheduleConfig;
    const targetType = String((params.schedule as any)?.targetType ?? '').trim();

    // Only implement recurring computation initially; other automations can supply explicit nextRunAt.
    if (String(params.automationCode) === 'RECURRING_JOURNAL_AUTOMATION') {
      if (targetType !== 'RECURRING_TEMPLATE') return null;

      const frequency = String(config?.frequency ?? 'MONTHLY').toUpperCase();
      const dayOfMonth = Number(config?.dayOfMonth ?? 1);
      const hourUtc = Number(config?.hourUtc ?? 2);

      if (frequency === 'MONTHLY') {
        return computeNextRunAtMonthly({ lastRunAt: params.now, dayOfMonth, hourUtc });
      }
      if (frequency === 'QUARTERLY') {
        return computeNextRunAtQuarterly({ lastRunAt: params.now, dayOfMonth, hourUtc });
      }
      if (frequency === 'YEARLY') {
        const monthUtc = Number(config?.monthUtc ?? 0);
        return computeNextRunAtYearly({ lastRunAt: params.now, monthUtc, dayOfMonth, hourUtc });
      }

      return null;
    }

    return null;
  }

  async applyExpiryTransition(params: {
    tenantId: string;
    scheduleId: string;
    now: Date;
    permissionUsed: string;
    actorUserId?: string | null;
    req?: any;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });
    if (!isExpired((row as any).expiresAt, params.now)) return row;
    if (String((row as any).scheduleStatus) === 'EXPIRED') return row;
    if (String((row as any).scheduleStatus) === 'REVOKED') return row;

    const updated = await (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        scheduleStatus: 'EXPIRED',
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_SCHEDULE_EXPIRED' as AuditEventType,
        actorUserId: params.actorUserId ? String(params.actorUserId) : null,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async resolveDueSchedules(params: {
    tenantId: string;
    now: Date;
    includeSuspended?: boolean;
    limit?: number;
  }) {
    const where: any = {
      tenantId: params.tenantId,
      revokedAt: null,
      nextRunAt: { lte: params.now },
    };

    if (!params.includeSuspended) {
      where.scheduleStatus = { in: ['ACTIVE', 'REVIEW_REQUIRED', 'FAILED'] };
    }

    const rows = await (this.prisma as any).governanceAutomationSchedule.findMany({
      where,
      orderBy: [{ nextRunAt: 'asc' }],
      take: Math.max(1, Math.min(200, Math.floor(Number(params.limit ?? 50)))),
    });

    return Array.isArray(rows) ? rows : [];
  }

  async createSchedule(params: {
    tenantId: string;
    createdById: string;
    permissionUsed: string;
    req?: any;

    automationCode: string;
    targetType: string;
    targetId: string;

    scheduleConfig?: any;
    nextRunAt?: Date | string | null;
    expiresAt?: Date | string | null;
  }) {
    const automationCode = String(params.automationCode ?? '').trim();
    if (!automationCode) throw new BadRequestException('automationCode is required');

    const policy = getAutomationPolicy(automationCode as any);
    if (!policy) throw new BadRequestException(`Unknown automationCode: ${automationCode}`);

    const nextRunAt = toDate(params.nextRunAt);
    const expiresAt = toDate(params.expiresAt);

    const row = await (this.prisma as any).governanceAutomationSchedule.create({
      data: {
        tenantId: params.tenantId,
        automationCode,
        scheduleStatus: 'ACTIVE',
        targetType: String(params.targetType ?? '').trim(),
        targetId: String(params.targetId ?? '').trim(),
        scheduleConfig: params.scheduleConfig ?? null,
        nextRunAt,
        expiresAt,
        createdById: params.createdById,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_SCHEDULE_CREATED' as AuditEventType,
        actorUserId: params.createdById,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as AuditEntityType,
        entityId: row.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'AUTOMATION_SCHEDULE_CREATED' as any,
            permissionUsed: params.permissionUsed,
            actorUserId: params.createdById,
            tenantId: params.tenantId,
            req: params.req,
            after: {
              scheduleId: row.id,
              automationCode,
              targetType: row.targetType,
              targetId: row.targetId,
              nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
              expiresAt: expiresAt ? expiresAt.toISOString() : null,
            },
          }),
        },
      },
      this.prisma,
    );

    return row;
  }

  async getSchedule(params: { tenantId: string; scheduleId: string }) {
    const row = await (this.prisma as any).governanceAutomationSchedule.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.scheduleId,
      },
    });
    if (!row) throw new NotFoundException('Automation schedule not found');
    return row;
  }

  async listSchedules(params: {
    tenantId: string;
    automationCode?: string;
    scheduleStatus?: string;
    targetType?: string;
    targetId?: string;
  }) {
    const where: any = { tenantId: params.tenantId };
    if (params.automationCode) where.automationCode = String(params.automationCode);
    if (params.scheduleStatus) where.scheduleStatus = String(params.scheduleStatus);
    if (params.targetType) where.targetType = String(params.targetType);
    if (params.targetId) where.targetId = String(params.targetId);

    return (this.prisma as any).governanceAutomationSchedule.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
  }

  async suspendSchedule(params: {
    tenantId: string;
    scheduleId: string;
    suspendedById: string;
    permissionUsed: string;
    req?: any;
    reason?: string;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });

    const updated = await (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        scheduleStatus: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedById: params.suspendedById,
        lastFailureReason: params.reason ? String(params.reason) : row.lastFailureReason,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_SCHEDULE_SUSPENDED' as AuditEventType,
        actorUserId: params.suspendedById,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
        reason: params.reason,
      },
      this.prisma,
    );

    return updated;
  }

  async resumeSchedule(params: {
    tenantId: string;
    scheduleId: string;
    resumedById: string;
    permissionUsed: string;
    req?: any;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });

    const updated = await (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        scheduleStatus: 'ACTIVE',
        suspendedAt: null,
        suspendedById: null,
        consecutiveFailureCount: 0,
        lastFailureReason: null,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_SCHEDULE_RESUMED' as AuditEventType,
        actorUserId: params.resumedById,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async revokeSchedule(params: {
    tenantId: string;
    scheduleId: string;
    revokedById: string;
    permissionUsed: string;
    req?: any;
    reason?: string;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });

    const updated = await (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        scheduleStatus: 'REVOKED',
        revokedAt: new Date(),
        revokedById: params.revokedById,
        lastFailureReason: params.reason ? String(params.reason) : row.lastFailureReason,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'AUTOMATION_SCHEDULE_REVOKED' as AuditEventType,
        actorUserId: params.revokedById,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: params.permissionUsed,
        reason: params.reason,
      },
      this.prisma,
    );

    return updated;
  }

  async markAttempt(params: {
    tenantId: string;
    scheduleId: string;
    now: Date;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });
    return (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        lastRunAt: params.now,
      },
    });
  }

  async markSuccess(params: {
    tenantId: string;
    scheduleId: string;
    nextRunAt?: Date | null;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });

    const now = new Date();
    const shouldExpire = isExpired((row as any).expiresAt, now);

    return (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        consecutiveFailureCount: 0,
        lastFailureReason: null,
        scheduleStatus: shouldExpire ? 'EXPIRED' : row.scheduleStatus,
        nextRunAt: params.nextRunAt ?? (row as any).nextRunAt,
      },
    });
  }

  async markFailure(params: {
    tenantId: string;
    scheduleId: string;
    failureReason: string;
    automationCode: string;
  }) {
    const row = await this.getSchedule({ tenantId: params.tenantId, scheduleId: params.scheduleId });

    const policy = getAutomationPolicy(String(params.automationCode) as any);
    if (!policy) throw new BadRequestException(`Unknown automationCode: ${params.automationCode}`);

    const nextCount = Math.max(0, Math.floor(Number((row as any).consecutiveFailureCount ?? 0))) + 1;
    const shouldSuspend =
      nextCount >=
      Math.max(1, Math.floor(policy.suspensionRules.suspendAfterConsecutiveFailures));

    return (this.prisma as any).governanceAutomationSchedule.update({
      where: { id: row.id },
      data: {
        consecutiveFailureCount: nextCount,
        lastFailureReason: String(params.failureReason ?? '').trim() || 'automation_failed',
        scheduleStatus: shouldSuspend ? 'SUSPENDED' : row.scheduleStatus,
        suspendedAt: shouldSuspend ? new Date() : (row as any).suspendedAt,
      },
    });
  }
}
