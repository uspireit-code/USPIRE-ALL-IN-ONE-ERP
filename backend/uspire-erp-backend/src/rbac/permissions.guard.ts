import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

type PermissionRequirement =
  | string[]
  | {
      mode: 'any';
      permissions: string[];
    };

function permissionIsView(code: string): boolean {
  return (code || '').toUpperCase().endsWith('_VIEW');
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      !requirement ||
      (Array.isArray(requirement) && requirement.length === 0)
    ) {
      return true;
    }

    const required = Array.isArray(requirement)
      ? requirement
      : requirement.permissions;
    const mode = Array.isArray(requirement) ? 'all' : requirement.mode;

    const req = context.switchToHttp().getRequest<Request>();

    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new ForbiddenException('Missing tenant or user context');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        role: { tenantId: tenant.id },
      },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: {
                permission: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }

    const satisfiedBySystemView = new Set<string>();

    if (mode === 'all') {
      const missing = required.filter(
        (p) => !codes.has(p) && !satisfiedBySystemView.has(p),
      );
      if (missing.length > 0) {
        if (missing[0] === 'RECEIPT_POST') {
          throw new ForbiddenException(
            'You do not have permission to post receipts. Required: RECEIPT_POST.',
          );
        }
        throw new ForbiddenException(`Missing permission: ${missing[0]}`);
      }
    } else {
      const hasAny = required.some(
        (p) => codes.has(p) || satisfiedBySystemView.has(p),
      );
      if (!hasAny) {
        throw new ForbiddenException(`Missing permission: ${required[0]}`);
      }
    }

    const requiredForSoD = required.filter((p) => !satisfiedBySystemView.has(p));

    const conflict = await this.findSoDConflict({
      tenantId: tenant.id,
      userId: user.id,
      requiredPermissions: requiredForSoD,
      userPermissionCodes: codes,
    });

    if (conflict) {
      await this.prisma.soDViolationLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          permissionAttempted: conflict.permissionAttempted,
          conflictingPermission: conflict.conflictingPermission,
        },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'SOD_VIOLATION',
            entityType: 'USER',
            entityId: user.id,
            action: conflict.permissionAttempted,
            outcome: 'BLOCKED',
            reason: `Conflicts with ${conflict.conflictingPermission}`,
            userId: user.id,
            permissionUsed: conflict.permissionAttempted,
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        error: 'Action blocked by Segregation of Duties (SoD)',
        permissionAttempted: conflict.permissionAttempted,
        conflictingPermission: conflict.conflictingPermission,
      });
    }

    return true;
  }

  private async findSoDConflict(params: {
    tenantId: string;
    userId: string;
    requiredPermissions: string[];
    userPermissionCodes: Set<string>;
  }): Promise<null | {
    permissionAttempted: string;
    conflictingPermission: string;
  }> {
    const skipRulePairs = new Set([
      'FINANCE_GL_POST|FINANCE_GL_APPROVE',
      'FINANCE_GL_APPROVE|FINANCE_GL_POST',
    ]);

    const relevantRules = await this.prisma.soDRule.findMany({
      where: {
        tenantId: params.tenantId,
        OR: [
          { forbiddenPermissionA: { in: params.requiredPermissions } },
          { forbiddenPermissionB: { in: params.requiredPermissions } },
        ],
      },
      select: {
        forbiddenPermissionA: true,
        forbiddenPermissionB: true,
      },
    });

    for (const attempted of params.requiredPermissions) {
      for (const rule of relevantRules) {
        if (
          skipRulePairs.has(
            `${rule.forbiddenPermissionA}|${rule.forbiddenPermissionB}`,
          )
        ) {
          continue;
        }

        if (
          rule.forbiddenPermissionA === attempted &&
          params.userPermissionCodes.has(rule.forbiddenPermissionB)
        ) {
          return {
            permissionAttempted: attempted,
            conflictingPermission: rule.forbiddenPermissionB,
          };
        }

        if (
          rule.forbiddenPermissionB === attempted &&
          params.userPermissionCodes.has(rule.forbiddenPermissionA)
        ) {
          return {
            permissionAttempted: attempted,
            conflictingPermission: rule.forbiddenPermissionA,
          };
        }
      }
    }

    return null;
  }
}
