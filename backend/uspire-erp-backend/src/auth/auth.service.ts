import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AuditEntityType,
  AuditEventType,
  Tenant,
  User,
} from '@prisma/client';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getFirstEnv } from '../internal/env.util';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RequestUnlockDto } from './dto/request-unlock.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { ForceChangePasswordDto } from './dto/force-change-password.dto';
import { MailerService } from './mailer.service';
import { validatePasswordComplexity } from './password-policy';

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

type JwtRefreshPayload = {
  sub: string;
  tenantId: string;
  type: 'refresh';
  sessionId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  private resolveSessionIdleTimeoutMinutes(): number {
    const isTestMode =
      (process.env.NODE_ENV ?? '').toLowerCase() === 'test' ||
      (process.env.USPIRE_TEST_MODE ?? '').toString().toLowerCase() === 'true';
    return isTestMode ? 7 : 15;
  }

  isSessionExpired(
    session: { lastSeenAt?: Date | string | null; expiresAt?: Date | string | null },
    idleTimeoutMinutes: number,
    now: Date = new Date(),
  ): boolean {
    const rawLast = (session as any)?.lastSeenAt;
    const rawExpires = (session as any)?.expiresAt;

    const expiresAt = rawExpires
      ? rawExpires instanceof Date
        ? rawExpires
        : new Date(String(rawExpires))
      : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
      return true;
    }

    const lastSeenAt = rawLast
      ? rawLast instanceof Date
        ? rawLast
        : new Date(String(rawLast))
      : null;
    if (!lastSeenAt || Number.isNaN(lastSeenAt.getTime())) {
      return true;
    }

    const idleMs = Math.max(0, now.getTime() - lastSeenAt.getTime());
    return idleMs >= Math.max(1, idleTimeoutMinutes) * 60 * 1000;
  }

  private resolveSessionExpiresAt(now: Date = new Date()): Date {
    return new Date(now.getTime() + this.getRefreshTokenMaxAgeMs());
  }

  async forceChangePassword(dto: ForceChangePasswordDto, req: Request) {
    const emailOrUsername = String(dto?.emailOrUsername ?? '').trim().toLowerCase();
    const requestedTenantId = String(dto?.tenantId ?? '').trim();
    const newPassword = String(dto?.newPassword ?? '');
    const confirmPassword = String(dto?.confirmPassword ?? '');

    const requestId =
      (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() ||
      randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    if (!emailOrUsername) {
      throw new BadRequestException('Email is required');
    }
    if (!newPassword) {
      throw new BadRequestException('New password is required');
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      throw new BadRequestException(complexity.message);
    }

    let selected: any = null;
    if (requestedTenantId) {
      selected = await this.prisma.user.findFirst({
        where: {
          tenantId: requestedTenantId,
          isActive: true,
          email: emailOrUsername,
        } as any,
        select: {
          id: true,
          tenantId: true,
          email: true,
          passwordExpiresAt: true,
          mustChangePassword: true,
        } as any,
      });
    } else {
      const candidates: any[] = await this.prisma.user.findMany({
        where: {
          isActive: true,
          email: emailOrUsername,
        } as any,
        select: {
          id: true,
          tenantId: true,
          email: true,
          passwordExpiresAt: true,
          mustChangePassword: true,
        } as any,
        take: 20,
      });

      if (!candidates.length) {
        throw new UnauthorizedException('Invalid user');
      }

      const tenantIds = Array.from(new Set(candidates.map((c) => String(c.tenantId))));
      if (tenantIds.length !== 1) {
        throw new BadRequestException('Tenant resolution required');
      }
      selected = candidates[0];
    }

    if (!selected?.id || !selected?.tenantId) {
      throw new UnauthorizedException('Invalid user');
    }

    const mustChangePassword = Boolean(selected?.mustChangePassword);
    const passwordExpired = this.isPasswordExpired(selected);
    if (!mustChangePassword && !passwordExpired) {
      throw new BadRequestException('Password reset is not required');
    }

    try {
      const passwordHash = await this.hashPassword(newPassword);
      const now = new Date();
      const passwordExpiresAt = this.getPasswordExpiryDate(now);

      await this.prisma.user.update({
        where: { id: selected.id },
        data: {
          passwordHash,
          passwordChangedAt: now as any,
          passwordExpiresAt: passwordExpiresAt as any,
          mustChangePassword: false as any,
          failedLoginAttempts: 0,
          isLocked: false,
          lockedAt: null,
          passwordFailedAttempts: 0,
          passwordLockUntil: null,
        } as any,
        select: { id: true },
      });

      await this.prisma.userSession.updateMany({
        where: { tenantId: selected.tenantId, userId: selected.id, revokedAt: null } as any,
        data: { revokedAt: now } as any,
      });

      await this.writeAuthAuditEvent({
        tenantId: selected.tenantId,
        actorUserId: selected.id,
        eventType: 'PASSWORD_CHANGED' as any,
        entityType: 'USER' as any,
        entityId: selected.id,
        outcome: 'SUCCESS',
        reason: mustChangePassword ? 'first_login_reset' : 'password_expired_reset',
        ...requestMeta,
      });

      return { ok: true };
    } catch (err) {
      await this.writeAuthAuditEvent({
        tenantId: selected.tenantId,
        actorUserId: selected.id,
        eventType: 'PASSWORD_CHANGED' as any,
        entityType: 'USER' as any,
        entityId: selected.id,
        outcome: 'FAILED',
        reason: 'force_change_password_failed',
        ...requestMeta,
      });
      throw err;
    }
  }

  async ping(req: Request) {
    const sessionUser: any = req.user as any;
    const tenantId = String((req.tenant as any)?.id ?? sessionUser?.tenantId ?? '').trim();
    const userId = String(sessionUser?.id ?? '').trim();
    const sessionId = String(sessionUser?.sessionId ?? '').trim();

    if (!tenantId || !userId || !sessionId) {
      throw new UnauthorizedException('Missing session context');
    }

    const now = new Date();
    await (this.prisma.userSession as any).updateMany({
      where: {
        tenantId,
        userId,
        sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      } as any,
      data: { lastSeenAt: now },
    });

    return { success: true };
  }

  private async getActiveSession(params: { tenantId: string; userId: string }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    if (!tenantId || !userId) return null;

    const now = new Date();
    const idleTimeoutMinutes = this.resolveSessionIdleTimeoutMinutes();
    const minFreshLastSeenAt = new Date(
      now.getTime() - Math.max(1, idleTimeoutMinutes) * 60 * 1000,
    );
    return (this.prisma.userSession as any).findFirst({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gte: minFreshLastSeenAt },
      } as any,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async autoRevokeStaleSessions(params: {
    tenantId: string;
    userId: string;
    req?: Request;
    requestId?: string;
    sessionIds?: string[];
    reason: string;
  }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    if (!tenantId || !userId) return;

    const now = new Date();
    const idleTimeoutMinutes = this.resolveSessionIdleTimeoutMinutes();
    const staleBefore = new Date(
      now.getTime() - Math.max(1, idleTimeoutMinutes) * 60 * 1000,
    );

    const updated = await (this.prisma.userSession as any).updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        ...(params.sessionIds && params.sessionIds.length > 0
          ? { sessionId: { in: params.sessionIds } }
          : { lastSeenAt: { lt: staleBefore } }),
      } as any,
      data: { revokedAt: now },
    });

    const affected = Number((updated as any)?.count ?? 0);
    if (affected <= 0) return;

    if (params.req && params.requestId) {
      const meta = this.getRequestAuditMeta(params.req, params.requestId);
      await this.writeAuthAuditEvent({
        tenantId,
        actorUserId: userId,
        eventType: 'SESSION_AUTO_REVOKED_STALE' as any,
        entityType: 'USER' as any,
        entityId: userId,
        outcome: 'SUCCESS',
        reason: params.reason,
        metadata: {
          idleTimeoutMinutes,
          staleBefore,
          revokedCount: affected,
        },
        ...meta,
      }).catch(() => undefined);
    }
  }

  private async cleanupExpiredSessions(params: {
    tenantId: string;
    userId?: string;
    req?: Request;
    requestId?: string;
  }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    if (!tenantId) return;

    const now = new Date();

    const expired = await (this.prisma.userSession as any).findMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        revokedAt: null,
        expiresAt: { lt: now },
      } as any,
      select: {
        sessionId: true,
        userId: true,
        expiresAt: true,
      },
      take: 50,
    });

    if (!expired || expired.length === 0) return;

    const sessionIds = expired
      .map((s: any) => String(s?.sessionId ?? '').trim())
      .filter(Boolean);

    if (sessionIds.length === 0) return;

    await (this.prisma.userSession as any).updateMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        sessionId: { in: sessionIds },
        revokedAt: null,
      } as any,
      data: { revokedAt: now },
    });

    if (params.req && params.requestId) {
      const meta = this.getRequestAuditMeta(params.req, params.requestId);
      await Promise.all(
        expired.map((s: any) =>
          this.writeAuthAuditEvent({
            tenantId,
            actorUserId: String(s?.userId ?? '').trim() || null,
            eventType: 'SESSION_EXPIRED' as any,
            entityType: 'USER_SESSION' as any,
            entityId: String(s?.sessionId ?? '').trim() || 'unknown',
            outcome: 'SUCCESS',
            reason: 'session_expired',
            metadata: {
              sessionId: String(s?.sessionId ?? '').trim(),
              expiresAt: s?.expiresAt ?? null,
            },
            ...meta,
          }).catch(() => undefined),
        ),
      );
    }
  }

  private async createUserSession(params: {
    tenantId: string;
    userId: string;
    req: Request;
    requestId: string;
  }) {
    const now = new Date();
    const sessionId = randomUUID();
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();

    const row = await (this.prisma.userSession as any).create({
      data: {
        tenantId,
        userId,
        sessionId,
        realUserId: userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: this.resolveSessionExpiresAt(now),
        revokedAt: null,
        ipAddress: (params.req.ip ? String(params.req.ip) : null) as any,
        userAgent: (params.req.header('user-agent') ? String(params.req.header('user-agent')) : null) as any,
      } as any,
    });

    const meta = this.getRequestAuditMeta(params.req, params.requestId);
    await this.writeAuthAuditEvent({
      tenantId,
      actorUserId: userId,
      eventType: 'SESSION_CREATED' as any,
      entityType: 'USER_SESSION' as any,
      entityId: row.id,
      outcome: 'SUCCESS',
      reason: 'session_created',
      metadata: {
        sessionId,
        expiresAt: row.expiresAt,
      },
      ...meta,
    });

    return { row, sessionId };
  }

  private async listAvailableDelegations(params: { tenantId: string; delegateUserId: string }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const delegateUserId = String(params.delegateUserId ?? '').trim();
    if (!tenantId || !delegateUserId) return [];

    const now = new Date();
    const rows: any[] = await (this.prisma as any).userDelegation.findMany({
      where: {
        tenantId,
        delegateUserId,
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gte: now },
      } as any,
      select: {
        id: true,
        scope: true,
        startsAt: true,
        expiresAt: true,
        delegatorUser: { select: { id: true, name: true, jobTitle: true, email: true } },
      } as any,
      orderBy: { expiresAt: 'asc' } as any,
      take: 25,
    });

    return rows.map((d) => ({
      id: d.id,
      scope: d.scope,
      startsAt: d.startsAt,
      expiresAt: d.expiresAt,
      actingAsUserId: d.delegatorUser?.id,
      actingAsUserName: d.delegatorUser?.name,
      actingAsUserJobTitle: d.delegatorUser?.jobTitle,
      actingAsUserEmail: d.delegatorUser?.email,
    }));
  }

  private filterDelegatedPermissions(params: { scope: 'APPROVE' | 'POST' | 'BOTH'; codes: string[] }) {
    const scope = String(params.scope ?? 'BOTH').toUpperCase() as 'APPROVE' | 'POST' | 'BOTH';
    const codes = Array.isArray(params.codes) ? params.codes : [];

    return codes.filter((c) => {
      const code = String(c ?? '').toUpperCase();
      const isView = code.endsWith('_VIEW') || code.includes('.VIEW');
      const isApprove = code.endsWith('_APPROVE') || code.includes('_APPROVE_') || code.includes('APPROVE');
      const isPost = code.endsWith('_POST') || code.includes('_POST_') || code.includes('POST');
      if (isView) return true;
      if (scope === 'APPROVE') return isApprove;
      if (scope === 'POST') return isPost;
      return isApprove || isPost;
    });
  }

  async activateDelegation(params: { req: Request; delegationId: string }) {
    const req = params.req;
    const delegationId = String(params.delegationId ?? '').trim();
    if (!delegationId) {
      throw new BadRequestException('delegationId is required');
    }

    const sessionUser: any = req.user as any;
    const tenantId = String((req.tenant as any)?.id ?? sessionUser?.tenantId ?? '').trim();
    const realUserId = String(sessionUser?.id ?? '').trim();
    const sessionId = String(sessionUser?.sessionId ?? '').trim();

    if (!tenantId || !realUserId || !sessionId) {
      throw new UnauthorizedException('Missing session context');
    }

    const requestId = (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() || randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    const now = new Date();
    const delegation: any = await (this.prisma as any).userDelegation.findFirst({
      where: {
        id: delegationId,
        tenantId,
        delegateUserId: realUserId,
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gte: now },
      } as any,
      select: {
        id: true,
        scope: true,
        delegatorUserId: true,
        delegateUserId: true,
        startsAt: true,
        expiresAt: true,
      } as any,
    });

    if (!delegation) {
      throw new UnauthorizedException('Delegation is not active');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    const realUser = await this.prisma.user.findUnique({ where: { id: realUserId } });
    if (!realUser || !realUser.isActive || realUser.tenantId !== tenantId) {
      throw new UnauthorizedException('Invalid user');
    }

    const { roles: realRoles, permissions: realPermissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId,
      userId: realUserId,
    });

    const { roles: actingRoles, permissions: actingPermissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId,
      userId: String(delegation.delegatorUserId),
    });

    const delegated = this.filterDelegatedPermissions({ scope: delegation.scope, codes: actingPermissions });
    const mergedPermissions = Array.from(new Set([...(realPermissions ?? []), ...delegated]));

    await (this.prisma.userSession as any).updateMany({
      where: { tenantId, userId: realUserId, sessionId, revokedAt: null } as any,
      data: {
        delegationId: delegation.id,
        actingAsUserId: String(delegation.delegatorUserId),
        realUserId,
      } as any,
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant: tenant as any,
      user: realUser as any,
      roles: Array.from(new Set([...(realRoles ?? []), ...(actingRoles ?? [])])),
      permissions: mergedPermissions,
      sessionId,
      delegationId: delegation.id,
      actingAsUserId: String(delegation.delegatorUserId),
      realUserId,
    });

    await this.writeAuthAuditEvent({
      tenantId,
      actorUserId: realUserId,
      eventType: 'DELEGATION_ACTIVATED' as any,
      entityType: 'USER' as any,
      entityId: delegation.id,
      outcome: 'SUCCESS',
      reason: 'delegation_activated',
      metadata: {
        delegationId: delegation.id,
        actingAsUserId: String(delegation.delegatorUserId),
        realUserId,
        scope: delegation.scope,
        expiresAt: delegation.expiresAt,
      },
      ...requestMeta,
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAgeMs: this.getAccessTokenMaxAgeMs(),
      refreshMaxAgeMs: this.getRefreshTokenMaxAgeMs(),
      delegation: {
        delegationId: delegation.id,
        actingAsUserId: String(delegation.delegatorUserId),
        realUserId,
        scope: delegation.scope,
        expiresAt: delegation.expiresAt,
      },
    };
  }

  private async revokeAllUserSessions(params: {
    tenantId: string;
    userId: string;
    req?: Request;
    requestId?: string;
    reason: string;
  }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    if (!tenantId || !userId) return;

    const now = new Date();
    await this.prisma.userSession.updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (params.req && params.requestId) {
      const meta = this.getRequestAuditMeta(params.req, params.requestId);
      await this.writeAuthAuditEvent({
        tenantId,
        actorUserId: userId,
        eventType: 'SESSION_REVOKED' as any,
        entityType: 'USER' as any,
        entityId: userId,
        outcome: 'SUCCESS',
        reason: params.reason,
        ...meta,
      });
    }
  }

  async revokeSessionBySessionId(params: {
    tenantId: string;
    userId: string;
    sessionId: string;
    req?: Request;
    requestId?: string;
    reason: string;
  }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    const sessionId = String(params.sessionId ?? '').trim();
    if (!tenantId || !userId || !sessionId) return;

    const now = new Date();
    await this.prisma.userSession.updateMany({
      where: {
        tenantId,
        userId,
        sessionId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    if (params.req && params.requestId) {
      const meta = this.getRequestAuditMeta(params.req, params.requestId);
      await this.writeAuthAuditEvent({
        tenantId,
        actorUserId: userId,
        eventType: 'AUTH_LOGOUT' as any,
        entityType: 'USER_SESSION' as any,
        entityId: sessionId,
        outcome: 'SUCCESS',
        reason: params.reason,
        metadata: { sessionId },
        ...meta,
      });
    }
  }

  private isPasswordExpired(user: { passwordExpiresAt?: Date | string | null }): boolean {
    const raw = (user as any)?.passwordExpiresAt;
    if (!raw) return false;
    const expiresAt = raw instanceof Date ? raw : new Date(String(raw));
    if (Number.isNaN(expiresAt.getTime())) return false;
    return expiresAt.getTime() < Date.now();
  }

  async requestPasswordReset(dto: ForgotPasswordDto, req: Request) {
    const email = String(dto?.email ?? '').trim().toLowerCase();
    const requestedTenantId = String(dto?.tenantId ?? '').trim();

    const requestId =
      (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() ||
      randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    if (!email) {
      return {
        success: true,
        message:
          'If this account exists, password reset instructions have been sent.',
      };
    }

    let tenant: Tenant | null = null;
    let user: { id: string; tenantId: string; email: string } | null = null;

    if (requestedTenantId) {
      tenant = await this.prisma.tenant.findUnique({
        where: { id: requestedTenantId },
      });

      if (tenant) {
        user = await this.prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            email,
            isActive: true,
          },
          select: { id: true, tenantId: true, email: true },
        });
      }
    } else {
      const matches = await this.prisma.user.findMany({
        where: { email, isActive: true },
        select: { id: true, tenantId: true, email: true },
        take: 10,
      });

      const uniqueTenantIds = Array.from(new Set(matches.map((m) => m.tenantId)));
      if (uniqueTenantIds.length === 1 && matches.length > 0) {
        const tenantId = uniqueTenantIds[0];
        tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        user = matches.find((m) => m.tenantId === tenantId) ?? null;
      }
    }

    if (!tenant || !user) {
      return {
        success: true,
        message:
          'If this account exists, password reset instructions have been sent.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresMinutes = 15;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000);

    await (this.prisma as any).passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        userEmail: email,
        tokenHash,
        expiresAt,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      } as any,
      select: { id: true },
    });

    await this.writeAuthAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: 'PASSWORD_RESET_REQUESTED' as any,
      entityType: 'USER' as any,
      entityId: user.id,
      outcome: 'SUCCESS',
      reason: 'password_reset_requested',
      ...requestMeta,
    });

    await this.mailer.sendPasswordResetEmail({
      to: user.email,
      tenantName: tenant.name,
      resetToken: rawToken,
      expiresMinutes,
    });

    return {
      success: true,
      message:
        'If this account exists, password reset instructions have been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request) {
    const token = String(dto?.token ?? '').trim();
    const newPassword = String(dto?.newPassword ?? '');
    const confirmPassword = String(dto?.confirmPassword ?? '');

    const requestId =
      (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() ||
      randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      throw new BadRequestException(complexity.message);
    }

    const now = new Date();
    const candidates: any[] = await (this.prisma as any).passwordResetToken.findMany({
      where: {
        consumedAt: null,
        expiresAt: { gt: now },
      } as any,
      orderBy: { requestedAt: 'desc' } as any,
      take: 50,
      include: {
        tenant: { select: { id: true, name: true } },
        user: { select: { id: true, tenantId: true, email: true, isActive: true } },
      } as any,
    });

    let match: any = null;
    for (const row of candidates) {
      const ok = await bcrypt.compare(token, String(row?.tokenHash ?? ''));
      if (ok) {
        match = row;
        break;
      }
    }

    if (!match || !match.tenant || !match.user || !match.user.isActive) {
      await this.writeAuthAuditEvent({
        tenantId: match?.tenant?.id ?? null,
        actorUserId: match?.user?.id ?? null,
        eventType: 'PASSWORD_RESET_FAILED' as any,
        entityType: 'USER' as any,
        entityId: match?.user?.id ?? 'unknown',
        outcome: 'FAILED',
        reason: 'invalid_or_expired_token',
        ...requestMeta,
      });

      throw new BadRequestException('Invalid or expired reset token.');
    }

    await (this.prisma as any).passwordResetToken.update({
      where: { id: match.id },
      data: { consumedAt: now } as any,
    });

    const passwordHash = await this.hashPassword(newPassword);
    const passwordExpiresAt = this.getPasswordExpiryDate(now);

    await this.prisma.user.update({
      where: { id: match.user.id },
      data: {
        passwordHash,
        mustChangePassword: false as any,
        passwordChangedAt: now as any,
        passwordExpiresAt: passwordExpiresAt as any,
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
        passwordFailedAttempts: 0,
        passwordLockUntil: null,
      } as any,
    });

    await this.revokeAllUserSessions({
      tenantId: match.tenant.id,
      userId: match.user.id,
      req,
      requestId,
      reason: 'password_reset',
    });

    await this.writeAuthAuditEvent({
      tenantId: match.tenant.id,
      actorUserId: match.user.id,
      eventType: 'PASSWORD_RESET_SUCCESS' as any,
      entityType: 'USER' as any,
      entityId: match.user.id,
      outcome: 'SUCCESS',
      reason: 'password_reset_success',
      ...requestMeta,
    });

    return {
      success: true,
      message: 'Password reset successful. Please login.',
    };
  }

  private getPasswordExpiryDate(now: Date = new Date()): Date {
    return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  }

  private maskEmail(email: string): string {
    const e = String(email ?? '').trim();
    const at = e.indexOf('@');
    if (at <= 1) return '***';
    const user = e.slice(0, at);
    const domain = e.slice(at + 1);
    const head = user.slice(0, 1);
    const tail = user.slice(-1);
    const maskedUser = `${head}***${tail}`;
    return `${maskedUser}@${domain}`;
  }

  async adminUnlockUser(params: { tenantId: string; userId: string }) {
    const tenantId = String(params.tenantId ?? '').trim();
    const userId = String(params.userId ?? '').trim();
    if (!tenantId || !userId) {
      throw new BadRequestException('Invalid tenantId or userId');
    }

    await this.prisma.user.update({
      where: { id: userId, tenantId },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
        passwordFailedAttempts: 0,
        passwordLockUntil: null,
      } as any,
    });

    return { success: true, message: 'User unlocked successfully' };
  }

  async requestUnlock(dto: RequestUnlockDto, req: Request) {
    const email = String(dto?.email ?? '').trim().toLowerCase();

    const genericResponse = {
      success: true,
      message:
        'If this account exists, an unlock request has been sent to your System Administrator.',
    };

    if (!email) return genericResponse;

    const requestId = (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() || randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    let tenantId: string | null = null;
    const tenantHint = String(dto?.tenantId ?? '').trim();
    if (tenantHint) tenantId = tenantHint;

    let resolvedUser: { id: string; tenantId: string } | null = null;

    if (!tenantId) {
      const users = await this.prisma.user.findMany({
        where: { email },
        select: { id: true, tenantId: true },
      });

      const tenantIds = Array.from(new Set(users.map((u) => u.tenantId).filter(Boolean)));
      if (tenantIds.length === 1) {
        tenantId = tenantIds[0] ?? null;
        resolvedUser = users.find((u) => u.tenantId === tenantId) ?? null;
      }
    } else {
      resolvedUser = await this.prisma.user.findFirst({
        where: { email, tenantId },
        select: { id: true, tenantId: true },
      });
    }

    if (!tenantId) return genericResponse;

    try {
      const unlockRequest = await (this.prisma as any).unlockRequest.create({
        data: {
          tenantId,
          userEmail: email,
          userId: resolvedUser?.id ?? null,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      });

      await this.writeAuthAuditEvent({
        tenantId,
        actorUserId: null,
        eventType: 'ACCOUNT_UNLOCK_REQUESTED' as any,
        entityType: 'USER' as any,
        entityId: resolvedUser?.id ?? email,
        outcome: 'SUCCESS',
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        requestId: requestMeta.requestId,
        reason: `Unlock request submitted for account: ${this.maskEmail(email)}`,
        metadata: {
          unlockRequestId: unlockRequest?.id ?? null,
          ip: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      });

      const admins = await this.prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            {
              userRoles: {
                some: {
                  role: {
                    name: {
                      in: ['SUPER_ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN', 'SYSTEMADMIN'],
                    },
                  },
                },
              },
            },
            { email: { contains: 'admin' } },
          ],
        },
        select: { email: true },
      });

      const adminEmails = admins
        .map((a) => String(a.email ?? '').trim())
        .filter((v) => Boolean(v));

      if (adminEmails.length > 0) {
        await this.mailer.sendUnlockRequestEmail({
          to: adminEmails,
          tenantId,
          userEmail: email,
          unlockRequestId: String(unlockRequest?.id ?? ''),
          requestedAt: unlockRequest?.requestedAt ?? new Date(),
          ipAddress: unlockRequest?.ipAddress ?? requestMeta.ipAddress,
          userAgent: unlockRequest?.userAgent ?? requestMeta.userAgent,
        });
      }
    } catch {
      return genericResponse;
    }

    return {
      success: true,
      message: 'Unlock request has been sent to your System Administrator.',
    };
  }

  private resolveTwoFactorEnforcement(roles: string[], user: { twoFactorEnabled: boolean }) {
    const roleNames = (roles ?? []).map((r) => String(r ?? '').toUpperCase());
    const isAdminLike = roleNames.some((r) =>
      ['ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN', 'SYSTEM ADMIN', 'SUPER ADMIN'].includes(r),
    );
    const isFinanceLike = roleNames.some((r) => r.includes('FINANCE'));
    const isApproverLike = roleNames.some((r) =>
      /APPROVE|APPROVER|REVIEW|CONTROLLER|MANAGER/i.test(r),
    );

    const enforcedByPolicy = isAdminLike || isFinanceLike || isApproverLike;

    return {
      enforce: Boolean(user.twoFactorEnabled) || enforcedByPolicy,
      enforcedByPolicy,
    };
  }

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

  private normalizeTwoFactorMethod(value: unknown): 'EMAIL' | 'AUTHENTICATOR' | 'SMS' {
    const v = String(value ?? '').trim().toUpperCase();
    if (v === 'SMS') return 'SMS';
    if (v === 'AUTHENTICATOR') return 'AUTHENTICATOR';
    if (v === 'TOTP') return 'AUTHENTICATOR';
    return 'EMAIL';
  }

  private async writeAuthAuditEvent(params: {
    tenantId: string | null;
    actorUserId: string | null;
    eventType: AuditEventType;
    entityType: AuditEntityType;
    entityId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    permissionUsed?: string;
    outcome?: 'SUCCESS' | 'FAILED' | 'BLOCKED';
    reason?: string;
    metadata?: Record<string, any>;
  }) {
    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        actorUserId: params.actorUserId,
        timestamp: new Date(),
        outcome: params.outcome as any,
        permissionUsed: params.permissionUsed,
        reason: params.reason,
        metadata: params.metadata,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? null,
      },
      this.prisma,
    );
  }

  async registerInternal(params: {
    tenantId: string;
    name: string;
    email: string;
    password: string;
    isActive?: boolean;
  }): Promise<User> {
    const now = new Date();
    const passwordExpiresAt = this.getPasswordExpiryDate(now);
    const passwordHash = await this.hashPassword(params.password);

    return this.prisma.user.create({
      data: {
        tenantId: params.tenantId,
        name: params.name.trim(),
        email: params.email.toLowerCase(),
        passwordHash,
        passwordChangedAt: now as any,
        passwordExpiresAt: passwordExpiresAt as any,
        mustChangePassword: false as any,
        isActive: params.isActive ?? true,
      },
    });
  }

  async login(req: Request, dto: LoginDto) {
    const identifier = String(dto.emailOrUsername ?? dto.email ?? '').trim();
    const email = identifier.toLowerCase();

    const lockThreshold = 5;

    const requestId = (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() || randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    const debugAuth = (process.env.DEBUG_AUTH ?? '').toString().toLowerCase() === 'true';
    const headerTenantIdRaw = req.header('x-tenant-id');
    const headerTenantId = String(headerTenantIdRaw ?? '').trim();
    const requestedTenantId = (dto.tenantId ?? '').trim();
    const requestedTenantName = (dto.tenantName ?? '').trim();

    if (debugAuth) {
      // eslint-disable-next-line no-console
      console.log('[AuthService.login] received', {
        email,
        bodyTenantId: requestedTenantId || null,
        bodyTenantName: requestedTenantName || null,
        headerTenantId: headerTenantId || null,
        hasHeaderTenantId: Boolean(headerTenantIdRaw),
      });
    }

    // 1) Authenticate the user FIRST (email + password), without assuming tenant context.
    // Since email is only unique per-tenant, we validate the password against all users
    // with this email, and then apply tenant selection rules.
    // NOTE: We include inactive users so we can emit AUTH_LOGIN_FAILED with an accurate reason.
    const candidates: any[] = await this.prisma.user.findMany({
      where: { email },
      select: {
        id: true,
        tenantId: true,
        email: true,
        passwordHash: true,
        mustChangePassword: true,
        passwordExpiresAt: true,
        isActive: true,
        failedLoginAttempts: true,
        isLocked: true,
        lockedAt: true,
        passwordFailedAttempts: true,
        passwordLockUntil: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        twoFactorLockUntil: true,
        twoFactorFailedAttempts: true,
      } as any,
      take: 10,
    } as any);

    if (debugAuth) {
      // eslint-disable-next-line no-console
      console.log('[AuthService.login] candidates', {
        count: candidates.length,
        tenantIds: Array.from(new Set(candidates.map((c) => c.tenantId))),
      });
    }

    if (candidates.length === 0) {
      await this.writeAuthAuditEvent({
        tenantId: null,
        actorUserId: null,
        eventType: 'AUTH_LOGIN_FAILED' as any,
        entityType: 'USER' as any,
        entityId: email || 'unknown',
        outcome: 'FAILED',
        reason: 'user_not_found',
        metadata: {
          identifierType: 'emailOrUsername',
        },
        ...requestMeta,
      });
      throw new UnauthorizedException({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const activeCandidates = candidates.filter((c) => Boolean(c?.isActive));
    if (activeCandidates.length === 0) {
      const u = candidates[0];
      await this.writeAuthAuditEvent({
        tenantId: u?.tenantId ?? null,
        actorUserId: u?.id ?? null,
        eventType: 'AUTH_LOGIN_FAILED' as any,
        entityType: 'USER' as any,
        entityId: u?.id ?? email,
        outcome: 'FAILED',
        reason: 'inactive_user',
        ...requestMeta,
      });
      throw new UnauthorizedException({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const lockedCandidate = activeCandidates.find((c) => Boolean(c?.isLocked));
    if (lockedCandidate) {
      await this.writeAuthAuditEvent({
        tenantId: lockedCandidate.tenantId ?? null,
        actorUserId: lockedCandidate.id ?? null,
        eventType: 'AUTH_LOGIN_LOCKED' as any,
        entityType: 'USER' as any,
        entityId: lockedCandidate.id,
        outcome: 'BLOCKED',
        reason: 'password_locked',
        ...requestMeta,
      });
      throw new UnauthorizedException({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: 'Your account has been locked. Please contact your System Administrator.',
      });
    }

    const passwordMatches: Array<{ id: string; tenantId: string; email: string }> = [];
    for (const u of activeCandidates) {
      const ok = await bcrypt.compare(dto.password, u.passwordHash);
      if (ok) {
        passwordMatches.push({ id: u.id, tenantId: u.tenantId, email: u.email });
      }
    }

    if (debugAuth) {
      // eslint-disable-next-line no-console
      console.log('[AuthService.login] passwordMatches', {
        count: passwordMatches.length,
        tenantIds: Array.from(new Set(passwordMatches.map((m) => m.tenantId))),
      });
    }

    if (passwordMatches.length === 0) {
      let maxNextAttempts = 0;
      let lockedTriggered = false;

      for (const u of activeCandidates) {
        const nextAttempts = Number(u?.failedLoginAttempts ?? 0) + 1;
        const shouldLock = nextAttempts >= lockThreshold;
        const lockAt = shouldLock ? new Date() : null;

        if (nextAttempts > maxNextAttempts) maxNextAttempts = nextAttempts;
        if (shouldLock) lockedTriggered = true;

        await this.prisma.user.update({
          where: { id: u.id },
          data: {
            failedLoginAttempts: nextAttempts,
            isLocked: shouldLock,
            lockedAt: lockAt as any,
            passwordFailedAttempts: 0,
            passwordLockUntil: null,
          } as any,
        });

        await this.writeAuthAuditEvent({
          tenantId: u.tenantId ?? null,
          actorUserId: u.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: u.id,
          outcome: 'FAILED',
          reason: 'password_mismatch',
          metadata: {
            failedAttempts: nextAttempts,
          },
          ...requestMeta,
        });

        if (shouldLock) {
          await this.writeAuthAuditEvent({
            tenantId: u.tenantId ?? null,
            actorUserId: u.id ?? null,
            eventType: 'AUTH_LOGIN_LOCKED' as any,
            entityType: 'USER' as any,
            entityId: u.id,
            outcome: 'BLOCKED',
            reason: 'threshold_exceeded',
            metadata: {
              failedAttempts: nextAttempts,
            },
            ...requestMeta,
          });
        }
      }

      if (lockedTriggered) {
        throw new UnauthorizedException({
          success: false,
          error: 'ACCOUNT_LOCKED',
          message: 'Account locked due to multiple failed login attempts',
        });
      }

      const remainingAttempts = Math.max(0, lockThreshold - maxNextAttempts);
      throw new UnauthorizedException({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        remainingAttempts,
      });
    }

    const matchedUserIds = new Set(passwordMatches.map((m) => m.id));
    for (const u of candidates) {
      if (!matchedUserIds.has(u.id)) continue;
      const hasAnyReset =
        Number(u?.failedLoginAttempts ?? 0) !== 0 ||
        Boolean(u?.isLocked) ||
        Number(u?.passwordFailedAttempts ?? 0) !== 0 ||
        Boolean(u?.passwordLockUntil);
      if (!hasAnyReset) continue;
      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          failedLoginAttempts: 0,
          isLocked: false,
          lockedAt: null,
          passwordFailedAttempts: 0,
          passwordLockUntil: null,
        } as any,
      });
    }

    // 2) Resolve tenant AFTER authentication.
    let selectedTenantId: string | null = null;

    if (requestedTenantId) {
      const tenantExists = await this.prisma.tenant.findUnique({
        where: { id: requestedTenantId },
        select: { id: true },
      });
      if (!tenantExists) {
        const anyMatch = passwordMatches[0];
        await this.writeAuthAuditEvent({
          tenantId: null,
          actorUserId: anyMatch?.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: anyMatch?.id ?? email,
          outcome: 'FAILED',
          reason: 'tenant_not_found',
          ...requestMeta,
        });
        throw new BadRequestException('Tenant not found');
      }

      const match = passwordMatches.find((m) => m.tenantId === requestedTenantId);
      if (!match) {
        const anyMatch = passwordMatches[0];
        await this.writeAuthAuditEvent({
          tenantId: requestedTenantId,
          actorUserId: anyMatch?.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: anyMatch?.id ?? email,
          outcome: 'FAILED',
          reason: 'tenant_mismatch',
          ...requestMeta,
        });
        throw new BadRequestException('User is not assigned to the selected organisation.');
      }

      selectedTenantId = requestedTenantId;
    } else if (requestedTenantName) {
      const tenantByName = await this.prisma.tenant.findFirst({
        where: { name: requestedTenantName },
        select: { id: true },
      });
      if (!tenantByName) {
        const anyMatch = passwordMatches[0];
        await this.writeAuthAuditEvent({
          tenantId: null,
          actorUserId: anyMatch?.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: anyMatch?.id ?? email,
          outcome: 'FAILED',
          reason: 'tenant_not_found',
          ...requestMeta,
        });
        throw new BadRequestException('Tenant not found');
      }

      const match = passwordMatches.find((m) => m.tenantId === tenantByName.id);
      if (!match) {
        const anyMatch = passwordMatches[0];
        await this.writeAuthAuditEvent({
          tenantId: tenantByName.id,
          actorUserId: anyMatch?.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: anyMatch?.id ?? email,
          outcome: 'FAILED',
          reason: 'tenant_mismatch',
          ...requestMeta,
        });
        throw new BadRequestException('User is not assigned to the selected organisation.');
      }

      selectedTenantId = tenantByName.id;
    } else {
      const uniqueTenantIds = [...new Set(passwordMatches.map((m) => m.tenantId))];

      if (debugAuth) {
        // eslint-disable-next-line no-console
        console.log('[AuthService.login] auto-select evaluation', {
          uniqueTenantIds,
        });
      }

      if (uniqueTenantIds.length === 0) {
        const anyMatch = passwordMatches[0];
        await this.writeAuthAuditEvent({
          tenantId: null,
          actorUserId: anyMatch?.id ?? null,
          eventType: 'AUTH_LOGIN_FAILED' as any,
          entityType: 'USER' as any,
          entityId: anyMatch?.id ?? email,
          outcome: 'FAILED',
          reason: 'user_not_assigned',
          ...requestMeta,
        });
        throw new BadRequestException('User is not assigned to any organisation.');
      }

      if (uniqueTenantIds.length > 1) {
        return {
          requiresTenant: true,
          message: 'Tenant resolution required',
        };
      }

      selectedTenantId = uniqueTenantIds[0];
    }

    if (debugAuth) {
      // eslint-disable-next-line no-console
      console.log('[AuthService.login] selectedTenantId', {
        selectedTenantId,
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: selectedTenantId },
    });
    if (!tenant) {
      const anyMatch = passwordMatches[0];
      await this.writeAuthAuditEvent({
        tenantId: selectedTenantId ?? null,
        actorUserId: anyMatch?.id ?? null,
        eventType: 'AUTH_LOGIN_FAILED' as any,
        entityType: 'USER' as any,
        entityId: anyMatch?.id ?? email,
        outcome: 'FAILED',
        reason: 'tenant_not_found',
        ...requestMeta,
      });
      throw new BadRequestException('Tenant not found');
    }

    const selectedUser = passwordMatches.find((m) => m.tenantId === tenant.id);
    if (!selectedUser) {
      // Should not be possible given the checks above, but keep it defensive.
      const anyMatch = passwordMatches[0];
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: anyMatch?.id ?? null,
        eventType: 'AUTH_LOGIN_FAILED' as any,
        entityType: 'USER' as any,
        entityId: anyMatch?.id ?? email,
        outcome: 'FAILED',
        reason: 'user_not_assigned',
        ...requestMeta,
      });
      throw new BadRequestException('User is not assigned to any organisation.');
    }

    const selectedUserPolicy = candidates.find((c) => c.id === selectedUser.id);
    const mustChangePassword = Boolean(selectedUserPolicy?.mustChangePassword);
    const passwordExpired = this.isPasswordExpired(selectedUserPolicy);

    if (mustChangePassword || passwordExpired) {
      const reason = mustChangePassword
        ? 'FIRST_LOGIN_RESET'
        : 'PASSWORD_EXPIRED';

      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: selectedUser.id,
        eventType: 'PASSWORD_EXPIRED_LOGIN_BLOCKED' as any,
        entityType: 'USER' as any,
        entityId: selectedUser.id,
        outcome: 'BLOCKED',
        reason,
        metadata: {
          reason,
        },
        ...requestMeta,
      });

      return {
        requiresPasswordReset: true,
        reason,
        message: mustChangePassword
          ? 'Password reset required. Please set a new password to continue.'
          : 'Your password has expired. Please reset your password to continue.',
      };
    }

    const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId: tenant.id,
      userId: selectedUser.id,
    });

    await this.cleanupExpiredSessions({
      tenantId: tenant.id,
      userId: selectedUser.id,
      req,
      requestId,
    });

    await this.autoRevokeStaleSessions({
      tenantId: tenant.id,
      userId: selectedUser.id,
      req,
      requestId,
      reason: 'idle_timeout',
    });

    const active = await this.getActiveSession({
      tenantId: tenant.id,
      userId: selectedUser.id,
    });
    if (active) {
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: selectedUser.id,
        eventType: 'SESSION_LOGIN_BLOCKED' as any,
        entityType: 'USER' as any,
        entityId: selectedUser.id,
        outcome: 'BLOCKED',
        reason: 'active_session_exists',
        metadata: {
          existingSessionId: (active as any).sessionId,
        },
        ...requestMeta,
      });

      throw new UnauthorizedException({
        success: false,
        error: 'SESSION_EXISTS',
        message:
          'This account is already logged in on another device. Please logout from the other session before continuing.',
      });
    }

    const user2fa = candidates.find((c) => c.id === selectedUser.id);
    const lockUntil = user2fa?.twoFactorLockUntil ?? null;
    if (lockUntil && lockUntil instanceof Date && lockUntil.getTime() > Date.now()) {
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: selectedUser.id,
        eventType: 'AUTH_2FA_LOCKED' as any,
        entityType: 'USER' as any,
        entityId: selectedUser.id,
        outcome: 'BLOCKED',
        reason: 'two_factor_locked',
        ...requestMeta,
      });
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    const enforcement = this.resolveTwoFactorEnforcement(roles, {
      twoFactorEnabled: Boolean(user2fa?.twoFactorEnabled),
    });

    if (enforcement.enforce) {
      const method = this.normalizeTwoFactorMethod(user2fa?.twoFactorMethod ?? 'EMAIL');

      const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresMinutes = 10;
      const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

      const challenge = await (this.prisma as any).twoFactorChallenge.create({
        data: {
          tenantId: tenant.id,
          userId: selectedUser.id,
          method: method as any,
          otpHash,
          expiresAt,
          consumedAt: null,
          ipAddress: (req.ip ? String(req.ip) : null) as any,
          userAgent: (req.header('user-agent') ? String(req.header('user-agent')) : null) as any,
        } as any,
        select: { id: true },
      });

      if (method === ('EMAIL' as any)) {
        await this.mailer.sendTwoFactorOtpEmail({
          toEmail: selectedUser.email,
          otp,
          tenantName: tenant.name,
          expiresMinutes,
        });
      }

      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: selectedUser.id,
        eventType: 'AUTH_2FA_CHALLENGE_SENT' as any,
        entityType: 'TWO_FACTOR_CHALLENGE' as any,
        entityId: challenge.id,
        outcome: 'SUCCESS',
        reason: method === ('EMAIL' as any) ? 'otp_sent' : 'challenge_created',
        metadata: {
          method,
          maskedDestination: method === ('EMAIL' as any) ? this.maskEmail(selectedUser.email) : null,
        },
        ...requestMeta,
      });

      return {
        requires2fa: true,
        challengeId: challenge.id,
        method,
        maskedDestination:
          method === ('EMAIL' as any) ? this.maskEmail(selectedUser.email) : undefined,
      };
    }

    const { sessionId } = await this.createUserSession({
      tenantId: tenant.id,
      userId: selectedUser.id,
      req,
      requestId,
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user: { id: selectedUser.id, tenantId: tenant.id, email: selectedUser.email } as any,
      roles,
      permissions,
      sessionId,
    });

    await this.writeAuthAuditEvent({
      tenantId: tenant.id,
      actorUserId: selectedUser.id,
      eventType: 'AUTH_LOGIN_SUCCESS' as any,
      entityType: 'USER' as any,
      entityId: selectedUser.id,
      outcome: 'SUCCESS',
      reason: 'password_validated',
      ...requestMeta,
    });

    const availableDelegations = await this.listAvailableDelegations({
      tenantId: tenant.id,
      delegateUserId: selectedUser.id,
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAgeMs: this.getAccessTokenMaxAgeMs(),
      refreshMaxAgeMs: this.getRefreshTokenMaxAgeMs(),
      availableDelegations,
    };
  }

  async verify2fa(req: Request, dto: Verify2faDto) {
    const requestId = (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() || randomUUID();
    const requestMeta = this.getRequestAuditMeta(req, requestId);

    const challengeId = String(dto.challengeId ?? '').trim();
    const otp = String(dto.otp ?? '').trim();
    if (!challengeId || !otp) {
      throw new BadRequestException('Missing challengeId or otp');
    }

    const challenge: any = await (this.prisma as any).twoFactorChallenge.findUnique({
      where: { id: challengeId },
      include: {
        user: { select: { id: true, email: true, tenantId: true, isActive: true, twoFactorFailedAttempts: true, twoFactorLockUntil: true } },
        tenant: { select: { id: true, name: true } },
      } as any,
    });

    if (!challenge || !challenge.user || !challenge.tenant) {
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    const tenant = challenge.tenant as Tenant;
    const user = challenge.user as any;

    if (!user.isActive) {
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    if (challenge.consumedAt) {
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    const expiresAt = challenge.expiresAt instanceof Date ? challenge.expiresAt : new Date(String(challenge.expiresAt));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'AUTH_2FA_VERIFY_FAILED' as any,
        entityType: 'TWO_FACTOR_CHALLENGE' as any,
        entityId: challenge.id,
        outcome: 'FAILED',
        reason: 'expired_or_invalid',
        ...requestMeta,
      });
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    const lockUntil = user.twoFactorLockUntil instanceof Date ? user.twoFactorLockUntil : null;
    if (lockUntil && lockUntil.getTime() > Date.now()) {
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'AUTH_2FA_LOCKED' as any,
        entityType: 'USER' as any,
        entityId: user.id,
        outcome: 'BLOCKED',
        reason: 'two_factor_locked',
        ...requestMeta,
      });
      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    const ok = await bcrypt.compare(otp, String(challenge.otpHash ?? ''));

    if (!ok) {
      const nextAttempts = Number(user.twoFactorFailedAttempts ?? 0) + 1;
      const lockThreshold = 5;
      const lockMinutes = 10;
      const shouldLock = nextAttempts >= lockThreshold;
      const nextLockUntil = shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorFailedAttempts: nextAttempts,
          twoFactorLockUntil: nextLockUntil,
        } as any,
      });

      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'AUTH_2FA_VERIFY_FAILED' as any,
        entityType: 'TWO_FACTOR_CHALLENGE' as any,
        entityId: challenge.id,
        outcome: 'FAILED',
        reason: 'verification_failed',
        ...requestMeta,
      });

      if (shouldLock) {
        await this.writeAuthAuditEvent({
          tenantId: tenant.id,
          actorUserId: user.id,
          eventType: 'AUTH_2FA_LOCKED' as any,
          entityType: 'USER' as any,
          entityId: user.id,
          outcome: 'BLOCKED',
          reason: 'threshold_exceeded',
          ...requestMeta,
        });
      }

      throw new BadRequestException({
        error: 'Unable to verify identity. Please try again.',
      });
    }

    await (this.prisma as any).twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorFailedAttempts: 0,
        twoFactorLockUntil: null,
      } as any,
    });

    const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId: tenant.id,
      userId: user.id,
    });

    await this.cleanupExpiredSessions({
      tenantId: tenant.id,
      userId: user.id,
      req,
      requestId,
    });

    await this.autoRevokeStaleSessions({
      tenantId: tenant.id,
      userId: user.id,
      req,
      requestId,
      reason: 'idle_timeout',
    });

    const active = await this.getActiveSession({ tenantId: tenant.id, userId: user.id });
    if (active) {
      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'SESSION_LOGIN_BLOCKED' as any,
        entityType: 'USER' as any,
        entityId: user.id,
        outcome: 'BLOCKED',
        reason: 'active_session_exists',
        metadata: {
          existingSessionId: (active as any).sessionId,
          challengeId,
        },
        ...requestMeta,
      });

      throw new UnauthorizedException({
        success: false,
        error: 'SESSION_EXISTS',
        message:
          'This account is already logged in on another device. Please logout from the other session before continuing.',
      });
    }

    const { sessionId } = await this.createUserSession({
      tenantId: tenant.id,
      userId: user.id,
      req,
      requestId,
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user: { id: user.id, tenantId: tenant.id, email: user.email } as any,
      roles,
      permissions,
      sessionId,
    });

    await this.writeAuthAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: 'AUTH_2FA_VERIFY_SUCCESS' as any,
      entityType: 'TWO_FACTOR_CHALLENGE' as any,
      entityId: challenge.id,
      outcome: 'SUCCESS',
      reason: 'verified',
      ...requestMeta,
    });

    await this.writeAuthAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: 'AUTH_LOGIN_SUCCESS' as any,
      entityType: 'USER' as any,
      entityId: user.id,
      outcome: 'SUCCESS',
      reason: 'two_factor_verified',
      ...requestMeta,
    });

    const availableDelegations = await this.listAvailableDelegations({
      tenantId: tenant.id,
      delegateUserId: user.id,
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAgeMs: this.getAccessTokenMaxAgeMs(),
      refreshMaxAgeMs: this.getRefreshTokenMaxAgeMs(),
      availableDelegations,
    };
  }

  async refresh(req: Request, dto: RefreshTokenDto) {
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';

    const cookieRefreshToken = (req as any)?.cookies?.uspire_refresh_token;
    const refreshTokenRaw = String(dto.refreshToken ?? cookieRefreshToken ?? '').trim();
    if (!refreshTokenRaw) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshTokenRaw,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const sessionId = String((payload as any).sessionId ?? '').trim();
    if (!sessionId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.tenantId !== tenant.id) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const session = await (this.prisma.userSession as any).findFirst({
      where: {
        tenantId: tenant.id,
        userId: user.id,
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
      } as any,
    });

    if (!session) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const idleTimeoutMinutes = this.resolveSessionIdleTimeoutMinutes();
    if (this.isSessionExpired(session as any, idleTimeoutMinutes, now)) {
      await (this.prisma.userSession as any)
        .updateMany({
          where: { tenantId: tenant.id, userId: user.id, sessionId, revokedAt: null } as any,
          data: { revokedAt: now },
        })
        .catch(() => undefined);

      const requestId =
        (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim() ||
        randomUUID();
      const requestMeta = this.getRequestAuditMeta(req, requestId);

      await this.writeAuthAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: 'SESSION_AUTO_REVOKED_STALE' as any,
        entityType: 'USER' as any,
        entityId: user.id,
        outcome: 'SUCCESS',
        reason: 'idle_timeout',
        metadata: {
          idleTimeoutMinutes,
          lastSeenAt: (session as any)?.lastSeenAt ?? null,
          sessionId,
        },
        ...requestMeta,
      }).catch(() => undefined);

      throw new UnauthorizedException(
        'Your session has expired due to inactivity. Please login again.',
      );
    }

    await (this.prisma.userSession as any)
      .updateMany({
        where: { tenantId: tenant.id, userId: user.id, sessionId, revokedAt: null },
        data: { lastSeenAt: now },
      })
      .catch(() => undefined);

    const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId: tenant.id,
      userId: user.id,
    });

    const delegationId = String((session as any)?.delegationId ?? '').trim();
    const actingAsUserId = String((session as any)?.actingAsUserId ?? '').trim();
    const realUserId = String((session as any)?.realUserId ?? user.id ?? '').trim();

    if (delegationId) {
      const del: any = await (this.prisma as any).userDelegation.findFirst({
        where: {
          id: delegationId,
          tenantId: tenant.id,
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gte: now },
        } as any,
        select: { id: true, scope: true, delegatorUserId: true, delegateUserId: true, expiresAt: true } as any,
      });

      if (!del) {
        throw new UnauthorizedException('Delegation has expired. Please login again.');
      }

      const actingCtx = await this.getTenantScopedRolesAndPermissions({
        tenantId: tenant.id,
        userId: String(del.delegatorUserId),
      });

      const delegated = this.filterDelegatedPermissions({ scope: del.scope, codes: actingCtx.permissions });
      const mergedPermissions = Array.from(new Set([...(permissions ?? []), ...delegated]));
      const mergedRoles = Array.from(new Set([...(roles ?? []), ...(actingCtx.roles ?? [])]));

      const { accessToken, refreshToken } = await this.issueTokens({
        tenant,
        user,
        roles: mergedRoles,
        permissions: mergedPermissions,
        sessionId,
        delegationId,
        actingAsUserId: String(del.delegatorUserId),
        realUserId,
      });

      return {
        accessToken,
        refreshToken,
        accessMaxAgeMs: this.getAccessTokenMaxAgeMs(),
        refreshMaxAgeMs: this.getRefreshTokenMaxAgeMs(),
      };
    }

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user,
      roles,
      permissions,
      sessionId,
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAgeMs: this.getAccessTokenMaxAgeMs(),
      refreshMaxAgeMs: this.getRefreshTokenMaxAgeMs(),
    };
  }

  private getAccessTokenMaxAgeMs(): number {
    const accessExpiresIn = this.parseDurationToSeconds(
      getFirstEnv(['JWT_ACCESS_TTL', 'JWT_ACCESS_EXPIRES_IN']) ?? '15m',
      15 * 60,
    );
    return Math.max(1, accessExpiresIn) * 1000;
  }

  private getRefreshTokenMaxAgeMs(): number {
    const refreshExpiresIn = this.parseDurationToSeconds(
      getFirstEnv(['JWT_REFRESH_TTL', 'JWT_REFRESH_EXPIRES_IN']) ?? '7d',
      7 * 24 * 60 * 60,
    );
    return Math.max(1, refreshExpiresIn) * 1000;
  }

  async me(req: Request) {
    const sessionUser = req.user;

    if (!sessionUser) {
      throw new UnauthorizedException('Missing user context');
    }

    let tenant = req.tenant;
    if (!tenant) {
      const tenantIdFromToken = String((sessionUser as any).tenantId ?? '').trim();
      if (!tenantIdFromToken) {
        throw new UnauthorizedException('Missing tenant context');
      }
      const tenantFound = await this.prisma.tenant.findUnique({
        where: { id: tenantIdFromToken },
      });

      if (!tenantFound) {
        throw new UnauthorizedException('Tenant not found');
      }

      tenant = tenantFound;
      req.tenant = tenant;
    }

    const user: any = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        language: true,
        avatarUrl: true,
        isActive: true,
        tenantId: true,
      } as any,
    });

    if (!user || !user.isActive || user.tenantId !== tenant.id) {
      throw new UnauthorizedException('Invalid user');
    }

    const delegationId = String((sessionUser as any)?.delegationId ?? '').trim();
    const realUserId = String((sessionUser as any)?.realUserId ?? user.id ?? '').trim() || user.id;
    const actingAsUserId = String((sessionUser as any)?.actingAsUserId ?? '').trim() || undefined;

    const jwtPermissionCodes = Array.isArray((sessionUser as any)?.permissions)
      ? ((sessionUser as any).permissions as string[])
      : [];
    const jwtRoleNames = Array.isArray((sessionUser as any)?.roles)
      ? ((sessionUser as any).roles as string[])
      : [];

    // Backfill permissions for existing tenants/roles where seeds may not have been re-run.
    // This is intentionally additive-only (no permission removals) to avoid unexpected RBAC changes.
    const adminLikeRoleNames = new Set([
      'ADMIN',
      'SUPERADMIN',
      'SUPER_ADMIN',
      'SUPER ADMIN',
      'SYSTEM_ADMIN',
      'SYSTEMADMIN',
      'SYSTEM ADMIN',
      'SYSTEM ADMINISTRATOR',
    ]);

    const userAdminLikeRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        role: {
          tenantId: tenant.id,
          name: { in: Array.from(adminLikeRoleNames) },
        },
      },
      select: { roleId: true },
    });

    if (userAdminLikeRoles.length > 0) {
      const requiredPermissionCodes = [
        PERMISSIONS.SYSTEM.VIEW_ALL,
        PERMISSIONS.SYSTEM.SETTINGS_VIEW,
        PERMISSIONS.USER.VIEW,
        PERMISSIONS.USER.CREATE,
        PERMISSIONS.USER.EDIT,
        PERMISSIONS.ROLE.VIEW,
        PERMISSIONS.ROLE.ASSIGN,

        PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW,
        PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE,
        PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT,

        PERMISSIONS.MASTER_DATA.PROJECT.VIEW,
        PERMISSIONS.MASTER_DATA.PROJECT.CREATE,
        PERMISSIONS.MASTER_DATA.PROJECT.EDIT,
        PERMISSIONS.MASTER_DATA.PROJECT.CLOSE,

        PERMISSIONS.MASTER_DATA.FUND.VIEW,
        PERMISSIONS.MASTER_DATA.FUND.CREATE,
        PERMISSIONS.MASTER_DATA.FUND.EDIT,
      ] as const;

      const perms = await this.prisma.permission.findMany({
        where: { code: { in: [...requiredPermissionCodes] } },
        select: { id: true },
      });

      if (perms.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: userAdminLikeRoles.flatMap((r) =>
            perms.map((p) => ({ roleId: r.roleId, permissionId: p.id })),
          ),
          skipDuplicates: true,
        });
      }
    }

    const permissions = new Set<string>();
    const roles = new Set<string>();

    if (jwtPermissionCodes.length > 0) {
      for (const p of jwtPermissionCodes) permissions.add(String(p));
      for (const r of jwtRoleNames) roles.add(String(r));
    } else {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          userId: user.id,
          role: { tenantId: tenant.id },
        },
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: {
                select: {
                  permission: { select: { code: true } },
                },
              },
            },
          },
        },
      });

      for (const ur of userRoles) {
        roles.add(ur.role.name);
        for (const rp of ur.role.rolePermissions) {
          permissions.add(rp.permission.code);
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      const permissionList = Array.from(permissions);
      const arPerms = permissionList
        .filter((p) =>
          /^(AR_)?(INVOICE|RECEIPT|RECEIPTS|CREDIT_NOTE|REFUND)_(VIEW|CREATE|EDIT_DRAFT)/i.test(p),
        )
        .sort();

      // TEMP DEBUG: prove what the UI is receiving from /auth/me.
      // Intentionally filtered to AR perms only.
      // eslint-disable-next-line no-console
      console.log('[auth.me]', {
        email: user.email,
        tenantId: tenant.id,
        roles: Array.from(roles),
        permissionCount: permissionList.length,
        arPermissionCount: arPerms.length,
        arPermissions: arPerms,
      });
    }

    const availableDelegations = await this.listAvailableDelegations({
      tenantId: tenant.id,
      delegateUserId: user.id,
    });

    const delegation = delegationId
      ? {
          delegationId,
          realUserId: realUserId || user.id,
          actingAsUserId: actingAsUserId || undefined,
        }
      : null;

    const actingUser = actingAsUserId
      ? await this.prisma.user.findUnique({
          where: { id: actingAsUserId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            jobTitle: true,
            timezone: true,
            language: true,
            avatarUrl: true,
            isActive: true,
            tenantId: true,
          } as any,
        })
      : null;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        jobTitle: user.jobTitle ?? null,
        timezone: user.timezone ?? null,
        language: user.language ?? null,
        avatarUrl: user.avatarUrl ?? null,
        roles: Array.from(roles),
      },
      actingUser: actingUser && actingUser.isActive && String((actingUser as any).tenantId ?? '') === tenant.id
        ? {
            id: actingUser.id,
            name: actingUser.name,
            email: actingUser.email,
            phone: actingUser.phone ?? null,
            jobTitle: actingUser.jobTitle ?? null,
            timezone: actingUser.timezone ?? null,
            language: actingUser.language ?? null,
            avatarUrl: actingUser.avatarUrl ?? null,
          }
        : null,
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      permissions: Array.from(permissions),
      availableDelegations,
      delegation,
    };
  }

  private getTenantFromRequest(req: Request): Tenant {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }
    return tenant;
  }

  private async getTenantScopedRolesAndPermissions(params: {
    tenantId: string;
    userId: string;
  }): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: params.userId,
        role: { tenantId: params.tenantId },
      },
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: {
              select: {
                permission: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    const roles = new Set<string>();
    for (const ur of userRoles) {
      roles.add(ur.role.name);
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }

    return {
      roles: Array.from(roles),
      permissions: Array.from(permissions),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const roundsRaw = this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';
    const rounds = Number(roundsRaw);

    if (!Number.isFinite(rounds) || rounds < 4) {
      throw new BadRequestException('Invalid BCRYPT_SALT_ROUNDS');
    }

    return bcrypt.hash(password, rounds);
  }

  private async issueTokens(params: {
    tenant: Tenant;
    user: User;
    roles: string[];
    permissions: string[];
    sessionId: string;
    delegationId?: string;
    actingAsUserId?: string;
    realUserId?: string;
  }) {
    const accessPayload: JwtAccessPayload = {
      sub: params.user.id,
      tenantId: params.tenant.id,
      email: params.user.email,
      roles: params.roles,
      permissions: params.permissions,
      sessionId: params.sessionId,
      ...(params.delegationId ? { delegationId: params.delegationId } : {}),
      ...(params.actingAsUserId ? { actingAsUserId: params.actingAsUserId } : {}),
      ...(params.realUserId ? { realUserId: params.realUserId } : {}),
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: params.user.id,
      tenantId: params.tenant.id,
      type: 'refresh',
      sessionId: params.sessionId,
    };

    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';
    const refreshExpiresIn = this.parseDurationToSeconds(
      getFirstEnv(['JWT_REFRESH_TTL', 'JWT_REFRESH_EXPIRES_IN']) ?? '7d',
      7 * 24 * 60 * 60,
    );

    const accessToken = await this.jwtService.signAsync(accessPayload);
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private parseDurationToSeconds(
    value: string,
    fallbackSeconds: number,
  ): number {
    const trimmed = value.trim();
    if (!trimmed) return fallbackSeconds;

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    const match = trimmed.match(/^(\d+)([smhd])$/i);
    if (!match) return fallbackSeconds;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multiplier =
      unit === 's'
        ? 1
        : unit === 'm'
          ? 60
          : unit === 'h'
            ? 60 * 60
            : 60 * 60 * 24;

    return amount * multiplier;
  }
}
