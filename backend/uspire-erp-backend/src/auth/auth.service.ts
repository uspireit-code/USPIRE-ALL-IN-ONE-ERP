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
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

type JwtAccessPayload = {
  sub: string;
  tenantId: string;
  email: string;
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

    const tenant = await this.resolveTenantForLogin({
      req,
      tenantId: dto.tenantId,
      tenantName: dto.tenantName,
      email,
    });

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
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

    const { accessToken, refreshToken } = await this.issueTokens({
      tenant,
      user,
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

    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        tenantId: true,
      },
    });

    if (!user || !user.isActive || user.tenantId !== tenant.id) {
      throw new UnauthorizedException('Invalid user');
    }

    // Backfill permissions for existing tenants/roles where seeds may not have been re-run.
    // This is intentionally additive-only (no permission removals) to avoid unexpected RBAC changes.
    const financeOfficerRole = await this.prisma.role.findFirst({
      where: { tenantId: tenant.id, name: 'FINANCE_OFFICER' },
      select: { id: true },
    });

    if (financeOfficerRole?.id) {
      const recurringGeneratePerm = await this.prisma.permission.upsert({
        where: { code: 'FINANCE_GL_RECURRING_GENERATE' },
        create: {
          code: 'FINANCE_GL_RECURRING_GENERATE',
          description: 'Generate journals from recurring templates',
        },
        update: {
          description: 'Generate journals from recurring templates',
        },
        select: { id: true },
      });

      if (recurringGeneratePerm?.id) {
        await this.prisma.rolePermission.createMany({
          data: [
            {
              roleId: financeOfficerRole.id,
              permissionId: recurringGeneratePerm.id,
            },
          ],
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

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
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

  private async resolveTenantForLogin(params: {
    req: Request;
    tenantId?: string;
    tenantName?: string;
    email: string;
  }): Promise<Tenant> {
    if (params.req.tenant) return params.req.tenant;

    const tenantId = (params.tenantId ?? '').trim();
    if (tenantId) {
      const t = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!t) throw new UnauthorizedException('Invalid credentials');
      return t;
    }

    const tenantName = (params.tenantName ?? '').trim();
    if (tenantName) {
      const t = await this.prisma.tenant.findFirst({
        where: { name: tenantName },
      });
      if (!t) throw new UnauthorizedException('Invalid credentials');
      return t;
    }

    const users = await this.prisma.user.findMany({
      where: { email: params.email, isActive: true },
      select: { tenantId: true },
      take: 3,
    });

    const uniqueTenantIds = [...new Set(users.map((u) => u.tenantId))];
    if (uniqueTenantIds.length === 1) {
      const t = await this.prisma.tenant.findUnique({
        where: { id: uniqueTenantIds[0] },
      });
      if (!t) throw new UnauthorizedException('Invalid credentials');
      return t;
    }

    throw new BadRequestException(
      'Tenant is required for login. Provide tenantId or tenantName, or ensure the email is unique across tenants.',
    );
  }

  private async hashPassword(password: string): Promise<string> {
    const roundsRaw = this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';
    const rounds = Number(roundsRaw);

    if (!Number.isFinite(rounds) || rounds < 4) {
      throw new BadRequestException('Invalid BCRYPT_SALT_ROUNDS');
    }

    return bcrypt.hash(password, rounds);
  }

  private async issueTokens(params: { tenant: Tenant; user: User }) {
    const accessPayload: JwtAccessPayload = {
      sub: params.user.id,
      tenantId: params.tenant.id,
      email: params.user.email,
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
