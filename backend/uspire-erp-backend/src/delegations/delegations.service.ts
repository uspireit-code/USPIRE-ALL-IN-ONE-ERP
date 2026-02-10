import { BadRequestException, Injectable } from '@nestjs/common';
import { DelegationScope } from '@prisma/client';
import type { Request } from 'express';
import { getEffectiveActorContext } from '../auth/actor-context';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDelegationDto } from './dto/create-delegation.dto';
import type { ListDelegationsQueryDto } from './dto/list-delegations-query.dto';

function parseBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  private isDelegationActive(d: { revokedAt?: Date | null; startsAt: Date; expiresAt: Date }, now: Date): boolean {
    if (d.revokedAt) return false;
    return d.startsAt <= now && d.expiresAt >= now;
  }

  async createDelegation(params: { req: Request; dto: CreateDelegationDto }) {
    const { req, dto } = params;
    const actorCtx = getEffectiveActorContext(req);

    const delegatorUserId = String(dto.delegatorUserId ?? '').trim();
    const delegateUserId = String(dto.delegateUserId ?? '').trim();

    if (!delegatorUserId || !delegateUserId) {
      throw new BadRequestException('Delegator and delegate are required.');
    }

    if (delegatorUserId === delegateUserId) {
      throw new BadRequestException('Delegator and delegate must be different users.');
    }

    const startsAt = new Date(String(dto.startsAt));
    const expiresAt = new Date(String(dto.expiresAt));

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid start or expiry date.');
    }

    if (startsAt.getTime() > expiresAt.getTime()) {
      throw new BadRequestException('Delegation expiry must be after start time.');
    }

    const now = new Date();
    if (expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('Delegation expiry must be in the future.');
    }

    const maxDurationMs = 90 * 24 * 60 * 60 * 1000;
    if (expiresAt.getTime() - startsAt.getTime() > maxDurationMs) {
      throw new BadRequestException('Delegation duration cannot exceed 90 days.');
    }

    const [delegator, delegate] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: delegatorUserId, tenantId: actorCtx.tenantId },
        select: { id: true, isActive: true },
      }),
      this.prisma.user.findFirst({
        where: { id: delegateUserId, tenantId: actorCtx.tenantId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!delegator || !delegate || !delegator.isActive || !delegate.isActive) {
      throw new BadRequestException('Delegator and delegate must be valid active users.');
    }

    const overlapping = await (this.prisma as any).userDelegation.findFirst({
      where: {
        tenantId: actorCtx.tenantId,
        delegatorUserId,
        delegateUserId,
        revokedAt: null,
        startsAt: { lte: expiresAt },
        expiresAt: { gte: startsAt },
      } as any,
      select: { id: true, startsAt: true, expiresAt: true, revokedAt: true },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Delegation cannot be created because an active delegation already exists.',
      );
    }

    const scope = dto.scope as DelegationScope;

    const created = await (this.prisma as any).userDelegation.create({
      data: {
        tenantId: actorCtx.tenantId,
        delegatorUserId,
        delegateUserId,
        startsAt,
        expiresAt,
        scope,
        reason: dto.reason ? String(dto.reason) : null,
        createdByUserId: actorCtx.realUserId,
      } as any,
      select: {
        id: true,
        tenantId: true,
        delegatorUserId: true,
        delegateUserId: true,
        startsAt: true,
        expiresAt: true,
        revokedAt: true,
        scope: true,
        reason: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: actorCtx.tenantId,
        eventType: 'DELEGATION_CREATED' as any,
        actorUserId: actorCtx.realUserId,
        entityType: 'USER' as any,
        entityId: created.id,
        timestamp: new Date(),
        ipAddress: (req as any)?.ip ?? null,
        userAgent: (req as any)?.headers?.['user-agent'] ?? null,
        requestId: (req as any)?.headers?.['x-request-id'] ?? null,
        outcome: 'SUCCESS' as any,
        reason: 'delegation_created',
        metadata: {
          delegationId: created.id,
          createdByUserId: actorCtx.realUserId,
          delegatorUserId,
          delegateUserId,
          startsAt: created.startsAt,
          expiresAt: created.expiresAt,
          scope: created.scope,
          reason: created.reason ?? null,
        },
      },
      this.prisma,
    );

    return { delegation: created };
  }

  async listDelegations(params: { req: Request; query: ListDelegationsQueryDto }) {
    const { req, query } = params;
    const actorCtx = getEffectiveActorContext(req);

    const activeOnly = parseBool(query.activeOnly);
    const includeExpired = parseBool(query.includeExpired);

    const where: any = {
      tenantId: actorCtx.tenantId,
    };

    if (query.delegatorUserId) where.delegatorUserId = String(query.delegatorUserId);
    if (query.delegateUserId) where.delegateUserId = String(query.delegateUserId);

    const now = new Date();

    if (activeOnly === true) {
      where.revokedAt = null;
      where.startsAt = { lte: now };
      where.expiresAt = { gte: now };
    } else if (includeExpired !== true) {
      where.OR = [{ expiresAt: { gte: now } }, { revokedAt: null }];
    }

    const rows = await (this.prisma as any).userDelegation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        delegatorUserId: true,
        delegateUserId: true,
        startsAt: true,
        expiresAt: true,
        revokedAt: true,
        scope: true,
        reason: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    return {
      delegations: rows.map((d: any) => ({
        id: d.id,
        delegatorUserId: d.delegatorUserId,
        delegateUserId: d.delegateUserId,
        startsAt: d.startsAt,
        expiresAt: d.expiresAt,
        revokedAt: d.revokedAt,
        scope: d.scope,
        reason: d.reason,
        createdAt: d.createdAt,
        createdByUserId: d.createdByUserId,
        active: this.isDelegationActive(d, now),
      })),
    };
  }

  async revokeDelegation(params: { req: Request; id: string }): Promise<null | { ok: true; delegationId: string; revokedAt: Date }> {
    const { req } = params;
    const actorCtx = getEffectiveActorContext(req);

    const id = String(params.id ?? '').trim();
    if (!id) {
      throw new BadRequestException('Delegation id is required');
    }

    const existing: any = await (this.prisma as any).userDelegation.findFirst({
      where: { id, tenantId: actorCtx.tenantId } as any,
      select: {
        id: true,
        delegatorUserId: true,
        delegateUserId: true,
        revokedAt: true,
      },
    });

    if (!existing) return null;

    const revokedAt = existing.revokedAt ? new Date(existing.revokedAt) : new Date();

    if (!existing.revokedAt) {
      await (this.prisma as any).userDelegation.update({
        where: { id } as any,
        data: { revokedAt } as any,
      });
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: actorCtx.tenantId,
        eventType: 'DELEGATION_REVOKED' as any,
        actorUserId: actorCtx.realUserId,
        entityType: 'USER' as any,
        entityId: existing.id,
        timestamp: new Date(),
        ipAddress: (req as any)?.ip ?? null,
        userAgent: (req as any)?.headers?.['user-agent'] ?? null,
        requestId: (req as any)?.headers?.['x-request-id'] ?? null,
        outcome: 'SUCCESS' as any,
        reason: 'delegation_revoked',
        metadata: {
          delegationId: existing.id,
          revokedByUserId: actorCtx.realUserId,
          delegatorUserId: existing.delegatorUserId,
          delegateUserId: existing.delegateUserId,
          revokedAt,
        },
      },
      this.prisma,
    );

    return { ok: true, delegationId: existing.id, revokedAt };
  }
}
