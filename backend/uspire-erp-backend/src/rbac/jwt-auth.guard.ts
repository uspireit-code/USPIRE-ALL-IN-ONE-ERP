import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type JwtAccessPayload = {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  delegationId?: string;
  actingAsUserId?: string;
  realUserId?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveSessionIdleTimeoutMinutes(): number {
    const isTestMode =
      (process.env.NODE_ENV ?? '').toLowerCase() === 'test' ||
      (process.env.USPIRE_TEST_MODE ?? '').toString().toLowerCase() === 'true';
    return isTestMode ? 7 : 15;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const authHeader = req.header('authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');

    const cookieToken = (req as any)?.cookies?.uspire_access_token;
    const resolvedToken = scheme === 'Bearer' && token ? token : cookieToken;

    if (!resolvedToken) {
      throw new UnauthorizedException('Missing access token');
    }

    const secret =
      this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(resolvedToken, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const sessionId = String((payload as any)?.sessionId ?? '').trim();
    if (!sessionId) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      sessionId,
    } as any;

    if (req.tenant && req.tenant.id !== payload.tenantId) {
      throw new UnauthorizedException('Tenant context mismatch');
    }

    if (!req.tenant) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
      });
      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }
      req.tenant = tenant;
    }

    const now = new Date();
    const session = await (this.prisma.userSession as any).findFirst({
      where: {
        tenantId: payload.tenantId,
        userId: payload.sub,
        sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      } as any,
      select: {
        id: true,
        sessionId: true,
        lastSeenAt: true,
        expiresAt: true,
        delegationId: true,
        actingAsUserId: true,
        realUserId: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const idleTimeoutMinutes = this.resolveSessionIdleTimeoutMinutes();
    const lastSeenAt =
      (session as any).lastSeenAt instanceof Date
        ? (session as any).lastSeenAt
        : new Date(String((session as any).lastSeenAt ?? ''));

    const staleBefore = new Date(now.getTime() - Math.max(1, idleTimeoutMinutes) * 60 * 1000);
    const isIdleStale =
      lastSeenAt && !Number.isNaN(lastSeenAt.getTime())
        ? lastSeenAt.getTime() < staleBefore.getTime()
        : true;

    if (isIdleStale) {
      await (this.prisma.userSession as any)
        .updateMany({
          where: {
            tenantId: payload.tenantId,
            userId: payload.sub,
            sessionId,
            revokedAt: null,
          } as any,
          data: { revokedAt: now },
        })
        .catch(() => undefined);

      await (this.prisma.auditEvent as any)
        .create({
          data: {
            tenantId: payload.tenantId,
            eventType: 'SESSION_AUTO_REVOKED_STALE' as any,
            entityType: 'USER' as any,
            entityId: payload.sub,
            action: 'session_auto_revoke',
            outcome: 'SUCCESS',
            reason: 'idle_timeout',
            userId: payload.sub,
            metadata: {
              idleTimeoutMinutes,
              staleBefore,
              lastSeenAt: (session as any).lastSeenAt ?? null,
              sessionId,
            },
          } as any,
        })
        .catch(() => undefined);

      throw new UnauthorizedException(
        'Your session has expired due to inactivity. Please login again.',
      );
    }

    const delegationId = String((payload as any)?.delegationId ?? session?.delegationId ?? '').trim();
    const actingAsUserId = String((payload as any)?.actingAsUserId ?? session?.actingAsUserId ?? '').trim();
    const realUserId = String((payload as any)?.realUserId ?? session?.realUserId ?? payload.sub ?? '').trim();

    if (delegationId) {
      if (String(session?.delegationId ?? '').trim() !== delegationId) {
        throw new UnauthorizedException('Session expired or revoked');
      }

      const del: any = await (this.prisma as any).userDelegation.findFirst({
        where: {
          id: delegationId,
          tenantId: payload.tenantId,
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gte: now },
        } as any,
        select: { id: true, expiresAt: true, delegateUserId: true, delegatorUserId: true, scope: true },
      });

      if (!del) {
        await (this.prisma.auditEvent as any)
          .create({
            data: {
              tenantId: payload.tenantId,
              eventType: 'DELEGATION_EXPIRED_ACCESS_BLOCKED' as any,
              entityType: 'USER' as any,
              entityId: delegationId,
              action: 'delegation_access',
              outcome: 'BLOCKED',
              reason: 'delegation_not_active',
              userId: payload.sub,
            } as any,
          })
          .catch(() => undefined);

        throw new UnauthorizedException('Delegation has expired. Please login again.');
      }
    }

    await (this.prisma.userSession as any)
      .updateMany({
        where: {
          tenantId: payload.tenantId,
          userId: payload.sub,
          sessionId,
          revokedAt: null,
        } as any,
        data: { lastSeenAt: now },
      })
      .catch(() => undefined);

    (req.user as any).delegationId = delegationId || undefined;
    (req.user as any).actingAsUserId = actingAsUserId || undefined;
    (req.user as any).realUserId = realUserId || undefined;

    return true;
  }
}
