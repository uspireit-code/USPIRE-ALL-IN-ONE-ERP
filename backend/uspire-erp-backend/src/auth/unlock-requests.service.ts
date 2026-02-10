import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnlockRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private getRequestAuditMeta(req: Request, requestId: string) {
    const xff = req.header('x-forwarded-for');
    const ipFromXff = xff ? String(xff).split(',')[0]?.trim() : '';
    const ip = (ipFromXff || (req.ip ? String(req.ip) : '')).trim();

    return {
      ipAddress: ip || null,
      userAgent: (req.header('user-agent') ? String(req.header('user-agent')) : null) as any,
      requestId: requestId || null,
    };
  }

  private async writeAdminAuditEvent(params: {
    req: Request;
    tenantId: string;
    actorUserId: string | null;
    eventType: any;
    entityType: any;
    entityId: string;
    action: string;
    outcome?: 'SUCCESS' | 'FAILED' | 'BLOCKED';
    reason?: string;
    metadata?: Record<string, any>;
  }) {
    const requestId = (params.req.header('x-request-id') ? String(params.req.header('x-request-id')) : '').trim() || randomUUID();
    const meta = this.getRequestAuditMeta(params.req, requestId);

    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUserId: params.actorUserId,
        timestamp: new Date(),
        outcome: (params.outcome ?? 'SUCCESS') as any,
        action: params.action,
        reason: params.reason,
        metadata: params.metadata,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
      this.prisma,
    );
  }

  async listUnlockRequests(req: Request) {
    const tenantId = req.tenant?.id;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const rows = await (this.prisma as any).unlockRequest.findMany({
      where: { tenantId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        userEmail: true,
        userId: true,
        requestedAt: true,
        ipAddress: true,
        userAgent: true,
        status: true,
        resolvedAt: true,
      },
    });

    return { success: true, data: rows };
  }

  async resolveUnlockRequest(req: Request, unlockRequestId: string) {
    const tenantId = req.tenant?.id;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const actorUserId = String((req.user as any)?.id ?? '').trim() || null;

    const target = await (this.prisma as any).unlockRequest.findFirst({
      where: { id: unlockRequestId, tenantId },
      select: { id: true, userId: true, userEmail: true },
    });

    if (!target) throw new BadRequestException('Unlock request not found');

    await (this.prisma as any).unlockRequest.updateMany({
      where: { id: unlockRequestId, tenantId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    await this.writeAdminAuditEvent({
      req,
      tenantId,
      actorUserId,
      eventType: 'ACCOUNT_UNLOCK_REQUEST_RESOLVED',
      entityType: 'USER',
      entityId: target?.userId ?? target?.userEmail ?? unlockRequestId,
      action: 'resolve_unlock_request',
      reason: `Unlock request resolved for account: ${target?.userEmail ?? ''}`,
      metadata: { unlockRequestId },
    });

    return { success: true };
  }

  private async unlockUserById(params: { tenantId: string; userId: string }) {
    await this.prisma.user.update({
      where: { id: params.userId, tenantId: params.tenantId },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
        passwordFailedAttempts: 0,
        passwordLockUntil: null,
      } as any,
    });
  }

  async unlockUserFromRequest(req: Request, unlockRequestId: string) {
    const tenantId = req.tenant?.id;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const actorUserId = String((req.user as any)?.id ?? '').trim() || null;

    const unlockRequest = await (this.prisma as any).unlockRequest.findFirst({
      where: { id: unlockRequestId, tenantId },
    });

    if (!unlockRequest) throw new BadRequestException('Unlock request not found');

    let userId: string | null = unlockRequest.userId ?? null;

    if (!userId) {
      const u = await this.prisma.user.findFirst({
        where: { tenantId, email: String(unlockRequest.userEmail ?? '').toLowerCase() },
        select: { id: true },
      });
      userId = u?.id ?? null;
    }

    if (!userId) {
      throw new BadRequestException('Unable to resolve user for unlock request');
    }

    await this.unlockUserById({ tenantId, userId });

    await (this.prisma as any).unlockRequest.updateMany({
      where: { id: unlockRequestId, tenantId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), userId },
    });

    const resolved = await (this.prisma as any).unlockRequest.findFirst({
      where: { id: unlockRequestId, tenantId },
      select: { userEmail: true },
    });

    await this.writeAdminAuditEvent({
      req,
      tenantId,
      actorUserId,
      eventType: 'ACCOUNT_UNLOCKED',
      entityType: 'USER',
      entityId: userId,
      action: 'unlock_user_from_request',
      reason: `User unlocked from request: ${resolved?.userEmail ?? ''}`,
      metadata: { unlockRequestId },
    });

    return { success: true, message: 'User unlocked successfully' };
  }
}
