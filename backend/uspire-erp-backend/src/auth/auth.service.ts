import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Tenant, User } from '@prisma/client';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { getFirstEnv } from '../internal/env.util';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

type JwtAccessPayload = {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
};

type JwtRefreshPayload = {
  sub: string;
  tenantId: string;
  type: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerInternal(params: {
    tenantId: string;
    name: string;
    email: string;
    password: string;
    isActive?: boolean;
  }): Promise<User> {
    const passwordHash = await this.hashPassword(params.password);

    return this.prisma.user.create({
      data: {
        tenantId: params.tenantId,
        name: params.name.trim(),
        email: params.email.toLowerCase(),
        passwordHash,
        isActive: params.isActive ?? true,
      },
    });
  }

  async login(req: Request, dto: LoginDto) {
    const email = dto.email.toLowerCase();

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
    // Since email is only unique per-tenant, we validate the password against all active
    // users with this email, and then apply tenant selection rules.
    const candidates = await this.prisma.user.findMany({
      where: { email, isActive: true },
      select: {
        id: true,
        tenantId: true,
        email: true,
        passwordHash: true,
        isActive: true,
      },
      take: 10,
    });

    if (debugAuth) {
      // eslint-disable-next-line no-console
      console.log('[AuthService.login] candidates', {
        count: candidates.length,
        tenantIds: Array.from(new Set(candidates.map((c) => c.tenantId))),
      });
    }

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches: Array<{ id: string; tenantId: string; email: string }> = [];
    for (const u of candidates) {
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2) Resolve tenant AFTER authentication.
    let selectedTenantId: string | null = null;

    if (requestedTenantId) {
      const tenantExists = await this.prisma.tenant.findUnique({
        where: { id: requestedTenantId },
        select: { id: true },
      });
      if (!tenantExists) {
        throw new BadRequestException('Tenant not found');
      }

      const match = passwordMatches.find((m) => m.tenantId === requestedTenantId);
      if (!match) {
        throw new BadRequestException('User is not assigned to the selected organisation.');
      }

      selectedTenantId = requestedTenantId;
    } else if (requestedTenantName) {
      const tenantByName = await this.prisma.tenant.findFirst({
        where: { name: requestedTenantName },
        select: { id: true },
      });
      if (!tenantByName) {
        throw new BadRequestException('Tenant not found');
      }

      const match = passwordMatches.find((m) => m.tenantId === tenantByName.id);
      if (!match) {
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
        throw new BadRequestException('User is not assigned to any organisation.');
      }

      if (uniqueTenantIds.length > 1) {
        throw new BadRequestException(
          'Multiple organisations found. Please select one.',
        );
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
      throw new BadRequestException('Tenant not found');
    }

    const selectedUser = passwordMatches.find((m) => m.tenantId === tenant.id);
    if (!selectedUser) {
      // Should not be possible given the checks above, but keep it defensive.
      throw new BadRequestException('User is not assigned to any organisation.');
    }

    const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId: tenant.id,
      userId: selectedUser.id,
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user: { id: selectedUser.id, tenantId: tenant.id, email: selectedUser.email } as any,
      roles,
      permissions,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: selectedUser.id,
        email: selectedUser.email,
        roles,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      permissions,
    };
  }

  async refresh(req: Request, dto: RefreshTokenDto) {
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        dto.refreshToken,
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

    const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
      tenantId: tenant.id,
      userId: user.id,
    });

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user,
      roles,
      permissions,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async me(req: Request) {
    const tenant = this.getTenantFromRequest(req);
    const sessionUser = req.user;

    if (!sessionUser) {
      throw new UnauthorizedException('Missing user context');
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

    const permissions = new Set<string>();
    const roles = new Set<string>();
    for (const ur of userRoles) {
      roles.add(ur.role.name);
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.code);
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
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      permissions: Array.from(permissions),
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
  }) {
    const accessPayload: JwtAccessPayload = {
      sub: params.user.id,
      tenantId: params.tenant.id,
      email: params.user.email,
      roles: params.roles,
      permissions: params.permissions,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: params.user.id,
      tenantId: params.tenant.id,
      type: 'refresh',
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
