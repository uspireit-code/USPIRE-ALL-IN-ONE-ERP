import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEntityType, AuditEventType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { buildGovernanceAuditMetadata } from './governance-enforcement';

export type OverrideSessionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'REVOKED';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

@Injectable()
export class GovernanceOverrideSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(params: {
    tenantId: string;
    requestedById: string;

    overrideCode: string;
    entryPoint: string;

    reason: string;
    justification: string;

    expiresAt: Date | string;

    escalation?: { type?: string | null; reason?: string | null } | null;

    entityType?: AuditEntityType | null;
    entityId?: string | null;

    req?: any;
    permissionUsed: string;
  }) {
    const reason = String(params.reason ?? '').trim();
    const justification = String(params.justification ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('Override reason is required');
    if (justification.length < 3)
      throw new BadRequestException('Override justification is required');

    const expiresAt = toDate(params.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('Invalid expiresAt');

    const row = await (this.prisma as any).governanceOverrideSession.create({
      data: {
        tenantId: params.tenantId,
        overrideCode: params.overrideCode,
        entryPoint: params.entryPoint,
        status: 'REQUESTED',
        reason,
        justification,
        escalationType: params.escalation?.type ? String(params.escalation.type) : null,
        escalationReason: params.escalation?.reason ? String(params.escalation.reason) : null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        requestedById: params.requestedById,
        expiresAt,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'OVERRIDE_SESSION_CREATED' as AuditEventType,
        actorUserId: params.requestedById,
        entityType: 'GOVERNANCE_OVERRIDE_SESSION' as AuditEntityType,
        entityId: row.id,
        timestamp: new Date(),
        requestId: typeof params.req?.requestId === 'string' ? params.req.requestId : null,
        permissionUsed: params.permissionUsed,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'OVERRIDE_SESSION_CREATED',
            permissionUsed: params.permissionUsed,
            actorUserId: params.requestedById,
            tenantId: params.tenantId,
            req: params.req,
            after: {
              overrideCode: params.overrideCode,
              entryPoint: params.entryPoint,
              expiresAt: expiresAt.toISOString(),
              escalation: params.escalation ?? null,
              entityType: params.entityType ?? null,
              entityId: params.entityId ?? null,
            },
          }),
        },
      },
      this.prisma,
    );

    return row;
  }

  async getSession(params: { tenantId: string; sessionId: string }) {
    const row = await (this.prisma as any).governanceOverrideSession.findFirst({
      where: {
        id: params.sessionId,
        tenantId: params.tenantId,
      },
    });
    if (!row) throw new NotFoundException('Override session not found');
    return row;
  }

  async listSessions(params: {
    tenantId: string;
    status?: string;
    overrideCode?: string;
    requestedById?: string;
  }) {
    const where: any = {
      tenantId: params.tenantId,
    };
    if (params.status) where.status = String(params.status);
    if (params.overrideCode) where.overrideCode = String(params.overrideCode);
    if (params.requestedById) where.requestedById = String(params.requestedById);

    return (this.prisma as any).governanceOverrideSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async assertActiveApproved(params: { tenantId: string; sessionId: string }) {
    const row = await this.getSession(params);

    const exp = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
    const expired = !exp || Number.isNaN(exp.getTime()) ? true : exp.getTime() <= Date.now();

    if (expired) {
      throw new BadRequestException('Override session is expired');
    }

    if (String(row.status) !== 'APPROVED') {
      throw new BadRequestException('Override session is not approved');
    }

    return row;
  }

  async approveSession(params: {
    tenantId: string;
    sessionId: string;
    approvedById: string;
    req?: any;
    permissionUsed: string;
  }) {
    const row = await this.getSession({ tenantId: params.tenantId, sessionId: params.sessionId });

    const updated = await (this.prisma as any).governanceOverrideSession.update({
      where: { id: row.id },
      data: {
        status: 'APPROVED',
        approvedById: params.approvedById,
        approvedAt: new Date(),
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'OVERRIDE_SESSION_APPROVED' as AuditEventType,
        actorUserId: params.approvedById,
        entityType: 'GOVERNANCE_OVERRIDE_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        requestId: typeof params.req?.requestId === 'string' ? params.req.requestId : null,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async rejectSession(params: {
    tenantId: string;
    sessionId: string;
    rejectedById: string;
    req?: any;
    permissionUsed: string;
  }) {
    const row = await this.getSession({ tenantId: params.tenantId, sessionId: params.sessionId });

    const updated = await (this.prisma as any).governanceOverrideSession.update({
      where: { id: row.id },
      data: {
        status: 'REJECTED',
        rejectedById: params.rejectedById,
        rejectedAt: new Date(),
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'OVERRIDE_SESSION_REJECTED' as AuditEventType,
        actorUserId: params.rejectedById,
        entityType: 'GOVERNANCE_OVERRIDE_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        requestId: typeof params.req?.requestId === 'string' ? params.req.requestId : null,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async revokeSession(params: {
    tenantId: string;
    sessionId: string;
    revokedById: string;
    req?: any;
    permissionUsed: string;
  }) {
    const row = await this.getSession({ tenantId: params.tenantId, sessionId: params.sessionId });

    const updated = await (this.prisma as any).governanceOverrideSession.update({
      where: { id: row.id },
      data: {
        status: 'REVOKED',
        revokedById: params.revokedById,
        revokedAt: new Date(),
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'OVERRIDE_SESSION_REVOKED' as AuditEventType,
        actorUserId: params.revokedById,
        entityType: 'GOVERNANCE_OVERRIDE_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        requestId: typeof params.req?.requestId === 'string' ? params.req.requestId : null,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }

  async markExecuted(params: {
    tenantId: string;
    sessionId: string;
    executedById: string;
    req?: any;
    permissionUsed: string;
  }) {
    const row = await this.getSession({ tenantId: params.tenantId, sessionId: params.sessionId });

    const updated = await (this.prisma as any).governanceOverrideSession.update({
      where: { id: row.id },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: 'OVERRIDE_SESSION_EXECUTED' as AuditEventType,
        actorUserId: params.executedById,
        entityType: 'GOVERNANCE_OVERRIDE_SESSION' as AuditEntityType,
        entityId: updated.id,
        timestamp: new Date(),
        requestId: typeof params.req?.requestId === 'string' ? params.req.requestId : null,
        permissionUsed: params.permissionUsed,
      },
      this.prisma,
    );

    return updated;
  }
}
