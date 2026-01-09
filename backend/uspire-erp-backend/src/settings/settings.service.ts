import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from '../storage/storage.provider';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ValidateUserRolesDto } from './dto/validate-user-roles.dto';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const ALLOWED_FAVICON_MIME = new Set([
  'image/png',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

type PermissionModule =
  | 'Accounting'
  | 'Planning'
  | 'Assets'
  | 'Reports'
  | 'Audit'
  | 'Settings';

function inferModuleFromPermissionCode(code: string): PermissionModule {
  const c = (code || '').toLowerCase();

  if (c.startsWith('audit_') || c.startsWith('audit.')) return 'Audit';
  if (c.startsWith('fa_') || c.startsWith('fa.')) return 'Assets';

  if (
    c.startsWith('budget_') ||
    c.startsWith('forecast.') ||
    c.startsWith('dashboard.')
  ) {
    return 'Planning';
  }

  if (
    c.startsWith('report.') ||
    c.includes('_tb_') ||
    c.includes('_trial_balance_') ||
    c.includes('_pl_') ||
    c.includes('_pnl_') ||
    c.includes('_profit') ||
    c.includes('_bs_') ||
    c.includes('_balance_sheet_') ||
    c.includes('_cash_flow_') ||
    c.includes('_soce_') ||
    c.includes('_aging_')
  ) {
    return 'Reports';
  }

  if (
    c.startsWith('finance_') ||
    c.startsWith('ap_') ||
    c.startsWith('ar_') ||
    c.startsWith('bank_') ||
    c.startsWith('payment_') ||
    c.startsWith('tax_')
  ) {
    return 'Accounting';
  }

  return 'Settings';
}

function permissionIsApprovalLike(code: string): boolean {
  const c = (code || '').toLowerCase();
  return c.includes('approve') || c.includes('_approve');
}

function permissionIsReadOnlyLike(code: string): boolean {
  const c = (code || '').toLowerCase();
  return c.includes('view') || c.includes('_view');
}

function inferIntendedUsers(roleName: string): string | null {
  switch (roleName) {
    case 'ADMIN':
      return 'System administrators';
    case 'FINANCE_OFFICER':
      return 'Finance operations staff';
    case 'FINANCE_MANAGER':
      return 'Finance managers / GL approvers';
    case 'FINANCE_CONTROLLER':
      return 'Finance controllers / GL final posters';
    case 'AUDITOR':
      return 'Internal / external auditors';
    case 'FORECAST_MAKER':
      return 'FP&A contributors (forecast preparation)';
    case 'FORECAST_APPROVER':
      return 'FP&A managers (forecast approval)';
    default:
      return null;
  }
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private async ensureFinanceOfficerRole(tenantId: string) {
    const role = await this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: 'FINANCE_OFFICER' } },
      create: {
        tenantId,
        name: 'FINANCE_OFFICER',
        description: 'Finance operations role',
      },
      update: {
        description: 'Finance operations role',
      },
      select: { id: true },
    });

    const allowedPermissionCodes = [
      'AR_INVOICE_CREATE',
      'AR_INVOICE_EDIT_DRAFT',
      'AR_INVOICE_VIEW',
      'AR_RECEIPTS_CREATE',
      'AR_RECEIPTS_VIEW',
      'AR_CREDIT_NOTE_CREATE',
      'AR_CREDIT_NOTE_VIEW',
      'AR_REFUND_CREATE',
      'AR_REFUND_VIEW',
    ] as const;

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: [...allowedPermissionCodes] } },
      select: { id: true },
    });

    if (perms.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    // Enforce that FINANCE_OFFICER stays non-approver / non-poster.
    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { code: { notIn: [...allowedPermissionCodes] } },
      },
    });
  }

  private async ensureFinanceManagerRole(tenantId: string) {
    const role = await this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: 'FINANCE_MANAGER' } },
      create: {
        tenantId,
        name: 'FINANCE_MANAGER',
        description: 'Finance manager role (review/reject)',
      },
      update: {
        description: 'Finance manager role (review/reject)',
      },
      select: { id: true },
    });

    const allowedPermissionCodes = [
      'FINANCE_GL_VIEW',
      'FINANCE_GL_APPROVE',
      'FINANCE_GL_RECURRING_MANAGE',
      'FINANCE_GL_RECURRING_GENERATE',
      'FINANCE_COA_VIEW',
      'FINANCE_BUDGET_VIEW',

      'FINANCE_PERIOD_VIEW',
      'FINANCE_PERIOD_CHECKLIST_VIEW',
      'FINANCE_PERIOD_CHECKLIST_COMPLETE',

      'FINANCE_TB_VIEW',
      'FINANCE_CASHFLOW_VIEW',
      'FINANCE_SOE_VIEW',
      'FINANCE_DISCLOSURE_VIEW',

      'report.view.pl',
      'report.view.bs',
      'FINANCE_REPORT_EXPORT',
    ] as const;

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: [...allowedPermissionCodes] } },
      select: { id: true },
    });

    if (perms.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    // Enforce that FINANCE_MANAGER is review/reject + recurring controls only.
    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { code: { notIn: [...allowedPermissionCodes] } },
      },
    });
  }

  private async ensureFinanceControllerRole(tenantId: string) {
    const role = await this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: 'FINANCE_CONTROLLER' } },
      create: {
        tenantId,
        name: 'FINANCE_CONTROLLER',
        description: 'Finance controller role (final posting)',
      },
      update: {
        description: 'Finance controller role (final posting)',
      },
      select: { id: true },
    });

    const allowedPermissionCodes = [
      'FINANCE_GL_VIEW',
      'FINANCE_GL_FINAL_POST',
      'FINANCE_PERIOD_VIEW',
      'FINANCE_PERIOD_CREATE',
      'FINANCE_PERIOD_CLOSE',
      'FINANCE_PERIOD_CHECKLIST_VIEW',
      'FINANCE_PERIOD_CHECKLIST_COMPLETE',
      'FINANCE_COA_VIEW',
      'FINANCE_COA_UPDATE',
      'FINANCE_BUDGET_VIEW',

      'MASTER_DATA_DEPARTMENT_VIEW',
      'MASTER_DATA_DEPARTMENT_CREATE',
      'MASTER_DATA_DEPARTMENT_EDIT',

      'MASTER_DATA_PROJECT_VIEW',
      'MASTER_DATA_PROJECT_CREATE',
      'MASTER_DATA_PROJECT_EDIT',
      'MASTER_DATA_PROJECT_CLOSE',

      'MASTER_DATA_FUND_VIEW',
      'MASTER_DATA_FUND_CREATE',
      'MASTER_DATA_FUND_EDIT',

      'FINANCE_TB_VIEW',
      'FINANCE_CASHFLOW_VIEW',
      'FINANCE_SOE_VIEW',
      'FINANCE_DISCLOSURE_VIEW',

      'report.view.pl',
      'report.view.bs',
      'FINANCE_REPORT_EXPORT',
    ] as const;

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: [...allowedPermissionCodes] } },
      select: { id: true },
    });

    if (perms.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    // Enforce that FINANCE_CONTROLLER is final-post + minimal view controls only.
    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: { code: { notIn: [...allowedPermissionCodes] } },
      },
    });
  }

  async listRolesWithPermissions(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.ensureFinanceOfficerRole(tenant.id);
    await this.ensureFinanceManagerRole(tenant.id);
    await this.ensureFinanceControllerRole(tenant.id);

    const roles = await this.prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        rolePermissions: {
          select: {
            permission: { select: { code: true, description: true } },
          },
        },
      },
    });

    const sodRules = await this.prisma.soDRule.findMany({
      where: { tenantId: tenant.id },
      select: {
        forbiddenPermissionA: true,
        forbiddenPermissionB: true,
        description: true,
      },
    });

    const permissionDescriptionByCode = new Map<string, string>();
    for (const r of roles) {
      for (const rp of r.rolePermissions) {
        if (rp.permission.description) {
          permissionDescriptionByCode.set(
            rp.permission.code,
            rp.permission.description,
          );
        }
      }
    }

    return roles.map((r) => {
      const codes = r.rolePermissions.map((rp) => rp.permission.code);
      const codeSet = new Set(codes);

      const permissionsByModule: Record<
        PermissionModule,
        Array<{ label: string; explanation: string }>
      > = {
        Accounting: [],
        Planning: [],
        Assets: [],
        Reports: [],
        Audit: [],
        Settings: [],
      };

      for (const rp of r.rolePermissions) {
        const module = inferModuleFromPermissionCode(rp.permission.code);
        const desc = rp.permission.description?.trim() || 'Permission';
        permissionsByModule[module].push({ label: desc, explanation: desc });
      }

      const hasApproval = codes.some(permissionIsApprovalLike);
      const readOnly =
        codes.length > 0 && codes.every(permissionIsReadOnlyLike);
      const isAdmin = r.name === 'ADMIN';

      const controlRules: string[] = [];
      for (const rule of sodRules) {
        const aIn = codeSet.has(rule.forbiddenPermissionA);
        const bIn = codeSet.has(rule.forbiddenPermissionB);
        if (!aIn && !bIn) continue;

        if (rule.description?.trim()) {
          controlRules.push(rule.description.trim());
          continue;
        }

        const aDesc =
          permissionDescriptionByCode.get(rule.forbiddenPermissionA) ??
          'a restricted permission';
        const bDesc =
          permissionDescriptionByCode.get(rule.forbiddenPermissionB) ??
          'a restricted permission';

        if (aIn && bIn) {
          controlRules.push(
            `This role cannot include both: ${aDesc} and ${bDesc}.`,
          );
        } else if (aIn) {
          controlRules.push(
            `This role cannot be combined with another role that grants: ${bDesc}.`,
          );
        } else {
          controlRules.push(
            `This role cannot be combined with another role that grants: ${aDesc}.`,
          );
        }
      }

      const permissions = Object.entries(permissionsByModule)
        .filter(([, v]) => v.length > 0)
        .map(([module, v]) => ({
          module,
          items: v.sort((a, b) => a.label.localeCompare(b.label)),
        }));

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        intendedUsers: inferIntendedUsers(r.name),
        badges: {
          canApprove: hasApproval,
          readOnly,
          admin: isAdmin,
        },
        permissions,
        controlRules,
      };
    });
  }

  async getRoleDetails(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    if (!id) throw new BadRequestException('Missing role id');

    const role = await this.prisma.role.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        description: true,
        rolePermissions: {
          select: {
            permission: { select: { code: true, description: true } },
          },
        },
      },
    });
    if (!role) throw new NotFoundException('Role not found');

    const allPermissions = await this.prisma.permission.findMany({
      orderBy: { description: 'asc' },
      select: { code: true, description: true },
    });

    const assigned = new Set(
      role.rolePermissions.map((rp) => rp.permission.code),
    );

    const permissionsByModule: Record<
      PermissionModule,
      Array<{ label: string; explanation: string; allowed: boolean }>
    > = {
      Accounting: [],
      Planning: [],
      Assets: [],
      Reports: [],
      Audit: [],
      Settings: [],
    };

    const permissionDescriptionByCode = new Map<string, string>();
    for (const p of allPermissions) {
      if (p.description) permissionDescriptionByCode.set(p.code, p.description);
    }

    for (const p of allPermissions) {
      const module = inferModuleFromPermissionCode(p.code);
      const desc = p.description?.trim() || 'Permission';
      permissionsByModule[module].push({
        label: desc,
        explanation: desc,
        allowed: assigned.has(p.code),
      });
    }

    const sodRules = await this.prisma.soDRule.findMany({
      where: { tenantId: tenant.id },
      select: {
        forbiddenPermissionA: true,
        forbiddenPermissionB: true,
        description: true,
      },
    });

    const controlRules: string[] = [];
    for (const rule of sodRules) {
      const aIn = assigned.has(rule.forbiddenPermissionA);
      const bIn = assigned.has(rule.forbiddenPermissionB);
      if (!aIn && !bIn) continue;

      if (rule.description?.trim()) {
        controlRules.push(rule.description.trim());
        continue;
      }

      const aDesc =
        permissionDescriptionByCode.get(rule.forbiddenPermissionA) ??
        'a restricted permission';
      const bDesc =
        permissionDescriptionByCode.get(rule.forbiddenPermissionB) ??
        'a restricted permission';

      if (aIn && bIn) {
        controlRules.push(
          `This role cannot include both: ${aDesc} and ${bDesc}.`,
        );
      } else if (aIn) {
        controlRules.push(
          `This role cannot be combined with another role that grants: ${bDesc}.`,
        );
      } else {
        controlRules.push(
          `This role cannot be combined with another role that grants: ${aDesc}.`,
        );
      }
    }

    const permissions = Object.entries(permissionsByModule)
      .filter(([, v]) => v.length > 0)
      .map(([module, v]) => ({
        module,
        items: v.sort((a, b) => a.label.localeCompare(b.label)),
      }));

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      intendedUsers: inferIntendedUsers(role.name),
      permissions,
      controlRules,
    };
  }

  async listUsers(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const users = await this.prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.isActive ? ('ACTIVE' as const) : ('INACTIVE' as const),
      roles: u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
      createdAt: u.createdAt,
    }));
  }

  async listRoles(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.ensureFinanceManagerRole(tenant.id);
    await this.ensureFinanceControllerRole(tenant.id);

    const roles = await this.prisma.role.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, createdAt: true },
    });

    return roles;
  }

  async validateRoles(req: Request, dto: ValidateUserRolesDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const roleIds = Array.from(new Set(dto.roleIds ?? []));
    const roles = await this.prisma.role.findMany({
      where: { tenantId: tenant.id, id: { in: roleIds } },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    const conflicts = await this.findSoDConflictForRoles({
      tenantId: tenant.id,
      roleIds,
    });

    return {
      valid: !conflicts,
      conflicts: conflicts ?? [],
    };
  }

  async createUser(req: Request, dto: CreateUserDto) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant || !actor)
      throw new BadRequestException('Missing tenant or user context');

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name is required');
    const email = dto.email.toLowerCase().trim();
    if (!email) throw new BadRequestException('email is required');

    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const temporaryPassword = dto.temporaryPassword?.trim()
      ? dto.temporaryPassword.trim()
      : `Temp-${randomUUID().replace(/-/g, '').slice(0, 12)}!`;

    const roundsRaw = process.env.BCRYPT_SALT_ROUNDS ?? '12';
    const rounds = Number(roundsRaw);
    if (!Number.isFinite(rounds) || rounds < 4) {
      throw new BadRequestException('Invalid BCRYPT_SALT_ROUNDS');
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, rounds);

    const created = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.applyUserRoles({
        tenantId: tenant.id,
        actorUserId: actor.id,
        targetUserId: created.id,
        roleIds: dto.roleIds,
        selfUserId: actor.id,
      });
    }

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'USER_CREATE',
          entityType: 'USER',
          entityId: created.id,
          action: 'USER_CREATE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({ name: created.name, email: created.email }),
          userId: actor.id,
          permissionUsed: 'USER_CREATE',
        },
      })
      .catch(() => undefined);

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      status: created.isActive ? ('ACTIVE' as const) : ('INACTIVE' as const),
      createdAt: created.createdAt,
      temporaryPassword,
    };
  }

  async updateUserStatus(req: Request, id: string, dto: UpdateUserStatusDto) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant || !actor)
      throw new BadRequestException('Missing tenant or user context');

    if (!id) throw new BadRequestException('Missing user id');

    if (actor.id === id) {
      throw new BadRequestException('You cannot change your own status');
    }

    const target = await this.prisma.user.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, isActive: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const nextIsActive = dto.isActive;

    if (target.isActive && !nextIsActive) {
      const remainingAdmins = await this.countActiveAdminsExcludingUser({
        tenantId: tenant.id,
        excludeUserId: id,
      });
      if (remainingAdmins === 0) {
        throw new BadRequestException(
          'Cannot deactivate the last active admin',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: nextIsActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'USER_STATUS_CHANGE',
          entityType: 'USER',
          entityId: updated.id,
          action: 'USER_STATUS_CHANGE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({ isActive: updated.isActive }),
          userId: actor.id,
          permissionUsed: 'USER_EDIT',
        },
      })
      .catch(() => undefined);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      status: updated.isActive ? ('ACTIVE' as const) : ('INACTIVE' as const),
      createdAt: updated.createdAt,
    };
  }

  async updateUserRoles(req: Request, id: string, dto: UpdateUserRolesDto) {
    const tenant = req.tenant;
    const actor = req.user;
    if (!tenant || !actor)
      throw new BadRequestException('Missing tenant or user context');

    if (!id) throw new BadRequestException('Missing user id');

    await this.prisma.user
      .findFirst({ where: { id, tenantId: tenant.id }, select: { id: true } })
      .then((u) => {
        if (!u) throw new NotFoundException('User not found');
      });

    const roleIds = dto.roleIds ?? [];

    const out = await this.applyUserRoles({
      tenantId: tenant.id,
      actorUserId: actor.id,
      targetUserId: id,
      roleIds,
      selfUserId: actor.id,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'USER_ROLE_ASSIGN',
          entityType: 'USER',
          entityId: id,
          action: 'USER_ROLE_ASSIGN',
          outcome: 'SUCCESS',
          reason: JSON.stringify({ roleIds }),
          userId: actor.id,
          permissionUsed: 'USER_ASSIGN_ROLE',
        },
      })
      .catch(() => undefined);

    return out;
  }

  private async applyUserRoles(params: {
    tenantId: string;
    actorUserId: string;
    targetUserId: string;
    roleIds: string[];
    selfUserId: string;
  }) {
    const uniqueRoleIds = Array.from(new Set(params.roleIds));

    const roles = await this.prisma.role.findMany({
      where: { tenantId: params.tenantId, id: { in: uniqueRoleIds } },
      select: { id: true, name: true },
    });

    if (roles.length !== uniqueRoleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    const targetCurrent = await this.prisma.userRole.findMany({
      where: {
        userId: params.targetUserId,
        role: { tenantId: params.tenantId },
      },
      select: { roleId: true, role: { select: { name: true } } },
    });

    const beforeRoleIds = targetCurrent.map((r) => r.roleId);
    const beforeRoleNames = new Set(targetCurrent.map((r) => r.role.name));
    const afterRoleNames = new Set(roles.map((r) => r.name));

    if (params.targetUserId === params.selfUserId) {
      if (beforeRoleNames.has('ADMIN') && !afterRoleNames.has('ADMIN')) {
        throw new BadRequestException('You cannot remove your own admin role');
      }
    }

    if (beforeRoleNames.has('ADMIN') && !afterRoleNames.has('ADMIN')) {
      const remainingAdmins = await this.countActiveAdminsExcludingUser({
        tenantId: params.tenantId,
        excludeUserId: params.targetUserId,
      });
      if (remainingAdmins === 0) {
        throw new BadRequestException(
          'Cannot remove admin role from the last active admin',
        );
      }
    }

    const sodConflict = await this.findSoDConflictForRoles({
      tenantId: params.tenantId,
      roleIds: roles.map((r) => r.id),
    });

    if (sodConflict) {
      throw new ForbiddenException({
        error: 'Role combination violates Segregation of Duties (SoD)',
        conflictingPermissions: sodConflict,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: params.targetUserId, roleId: { in: beforeRoleIds } },
      });

      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((r) => ({
            userId: params.targetUserId,
            roleId: r.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    return {
      userId: params.targetUserId,
      roles: roles.map((r) => ({ id: r.id, name: r.name })),
    };
  }

  private async countActiveAdminsExcludingUser(params: {
    tenantId: string;
    excludeUserId: string;
  }): Promise<number> {
    const adminRole = await this.prisma.role.findFirst({
      where: { tenantId: params.tenantId, name: 'ADMIN' },
      select: { id: true },
    });
    if (!adminRole) return 0;

    return this.prisma.userRole.count({
      where: {
        roleId: adminRole.id,
        userId: { not: params.excludeUserId },
        user: { tenantId: params.tenantId, isActive: true },
      },
    });
  }

  private async findSoDConflictForRoles(params: {
    tenantId: string;
    roleIds: string[];
  }): Promise<null | { permissionA: string; permissionB: string }[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: params.roleIds },
        role: { tenantId: params.tenantId },
      },
      select: {
        permission: { select: { code: true } },
      },
    });

    const codes = new Set(rolePermissions.map((rp) => rp.permission.code));
    if (codes.size === 0) return null;

    const rules = await this.prisma.soDRule.findMany({
      where: { tenantId: params.tenantId },
      select: { forbiddenPermissionA: true, forbiddenPermissionB: true },
    });

    const conflicts: Array<{ permissionA: string; permissionB: string }> = [];
    for (const rule of rules) {
      if (
        codes.has(rule.forbiddenPermissionA) &&
        codes.has(rule.forbiddenPermissionB)
      ) {
        conflicts.push({
          permissionA: rule.forbiddenPermissionA,
          permissionB: rule.forbiddenPermissionB,
        });
      }
    }

    return conflicts.length > 0 ? conflicts : null;
  }

  async getOrganisation(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        organisationName: true,
        organisationShortName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        updatedAt: true,
      },
    });

    if (!row) throw new NotFoundException('Tenant not found');

    return {
      ...row,
      logoUrl: row.logoUrl ? '/settings/organisation/logo' : null,
    };
  }

  async getSystemConfig(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const row = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        name: true,
        organisationName: true,
        organisationShortName: true,
        legalName: true,
        defaultCurrency: true,
        country: true,
        timezone: true,
        financialYearStartMonth: true,
        dateFormat: true,
        numberFormat: true,
        defaultLandingPage: true,
        defaultDashboard: true,
        defaultLanguage: true,
        demoModeEnabled: true,
        defaultUserRoleCode: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        secondaryAccentColor: true,
        allowSelfPosting: true,
        receiptBankName: true,
        receiptBankAccountName: true,
        receiptBankAccountNumber: true,
        receiptBankBranch: true,
        receiptBankSwiftCode: true,
        requiresDepartmentOnInvoices: true,
        requiresProjectOnInvoices: true,
        requiresFundOnInvoices: true,
        arControlAccountId: true,
        defaultBankClearingAccountId: true,
        cashClearingAccountId: true,
        unappliedReceiptsAccountId: true,
        updatedAt: true,
      },
    });

    if (!row) throw new NotFoundException('Tenant not found');

    return {
      ...row,
      logoUrl: row.logoUrl ? '/settings/organisation/logo' : null,
      faviconUrl: row.faviconUrl ? '/settings/system/favicon' : null,
    };
  }

  async updateSystemConfig(req: Request, dto: UpdateSystemConfigDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const financeSensitiveKeys: Array<keyof UpdateSystemConfigDto> = [
      'allowSelfPosting',
      'requiresDepartmentOnInvoices',
      'requiresProjectOnInvoices',
      'requiresFundOnInvoices',
      'arControlAccountId',
      'defaultBankClearingAccountId',
      'cashClearingAccountId',
      'unappliedReceiptsAccountId',
    ];

    const isChangingFinanceControls = financeSensitiveKeys.some(
      (k) => (dto as any)?.[k] !== undefined,
    );

    if (isChangingFinanceControls) {
      const hasFinanceConfig = await this.prisma.rolePermission.findFirst({
        where: {
          role: {
            tenantId: tenant.id,
            userRoles: { some: { userId: user.id } },
          },
          permission: { code: 'FINANCE_CONFIG_CHANGE' },
        },
        select: { roleId: true },
      });

      if (!hasFinanceConfig) {
        throw new ForbiddenException({
          error: 'Access denied',
          missingPermissions: ['FINANCE_CONFIG_CHANGE'],
        });
      }
    }

    const before = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: {
        organisationName: true,
        organisationShortName: true,
        legalName: true,
        defaultCurrency: true,
        country: true,
        timezone: true,
        financialYearStartMonth: true,
        dateFormat: true,
        numberFormat: true,
        defaultLandingPage: true,
        defaultDashboard: true,
        defaultLanguage: true,
        demoModeEnabled: true,
        defaultUserRoleCode: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        secondaryAccentColor: true,
        allowSelfPosting: true,
        receiptBankName: true,
        receiptBankAccountName: true,
        receiptBankAccountNumber: true,
        receiptBankBranch: true,
        receiptBankSwiftCode: true,
        requiresDepartmentOnInvoices: true,
        requiresProjectOnInvoices: true,
        requiresFundOnInvoices: true,
        arControlAccountId: true,
        defaultBankClearingAccountId: true,
        cashClearingAccountId: true,
        unappliedReceiptsAccountId: true,
        faviconUrl: true,
        logoUrl: true,
      },
    });
    if (!before) throw new NotFoundException('Tenant not found');

    if (
      dto.financialYearStartMonth !== undefined &&
      dto.financialYearStartMonth !== null
    ) {
      if (dto.financialYearStartMonth < 1 || dto.financialYearStartMonth > 12) {
        throw new BadRequestException(
          'financialYearStartMonth must be between 1 and 12',
        );
      }
    }

    const updated = await (this.prisma as any).tenant.update({
      where: { id: tenant.id },
      data: {
        organisationName:
          dto.organisationName === undefined
            ? undefined
            : dto.organisationName === null
              ? undefined
              : dto.organisationName.trim(),
        organisationShortName:
          dto.organisationShortName === undefined
            ? undefined
            : dto.organisationShortName === null
              ? null
              : dto.organisationShortName.trim() || null,

        legalName:
          dto.legalName === undefined
            ? undefined
            : dto.legalName === null
              ? null
              : dto.legalName.trim() || null,
        defaultCurrency:
          dto.defaultCurrency === undefined
            ? undefined
            : dto.defaultCurrency === null
              ? null
              : dto.defaultCurrency.trim() || null,
        country:
          dto.country === undefined
            ? undefined
            : dto.country === null
              ? null
              : dto.country.trim() || null,
        timezone:
          dto.timezone === undefined
            ? undefined
            : dto.timezone === null
              ? null
              : dto.timezone.trim() || null,
        financialYearStartMonth:
          dto.financialYearStartMonth === undefined
            ? undefined
            : dto.financialYearStartMonth,
        dateFormat:
          dto.dateFormat === undefined
            ? undefined
            : dto.dateFormat === null
              ? null
              : dto.dateFormat.trim() || null,
        numberFormat:
          dto.numberFormat === undefined
            ? undefined
            : dto.numberFormat === null
              ? null
              : dto.numberFormat.trim() || null,

        defaultLandingPage:
          dto.defaultLandingPage === undefined
            ? undefined
            : dto.defaultLandingPage === null
              ? null
              : dto.defaultLandingPage.trim() || null,
        defaultDashboard:
          dto.defaultDashboard === undefined
            ? undefined
            : dto.defaultDashboard === null
              ? null
              : dto.defaultDashboard.trim() || null,
        defaultLanguage:
          dto.defaultLanguage === undefined
            ? undefined
            : dto.defaultLanguage === null
              ? null
              : dto.defaultLanguage.trim() || null,
        demoModeEnabled:
          dto.demoModeEnabled === undefined ? undefined : dto.demoModeEnabled,
        defaultUserRoleCode:
          dto.defaultUserRoleCode === undefined
            ? undefined
            : dto.defaultUserRoleCode === null
              ? null
              : dto.defaultUserRoleCode.trim() || null,

        primaryColor:
          dto.primaryColor === undefined
            ? undefined
            : dto.primaryColor === null
              ? undefined
              : dto.primaryColor.trim() || undefined,
        secondaryColor:
          dto.secondaryColor === undefined
            ? undefined
            : dto.secondaryColor === null
              ? null
              : dto.secondaryColor.trim() || null,
        accentColor:
          dto.accentColor === undefined
            ? undefined
            : dto.accentColor === null
              ? null
              : dto.accentColor.trim() || null,
        secondaryAccentColor:
          dto.secondaryAccentColor === undefined
            ? undefined
            : dto.secondaryAccentColor === null
              ? null
              : dto.secondaryAccentColor.trim() || null,

        allowSelfPosting:
          (dto as any).allowSelfPosting === undefined
            ? undefined
            : (dto as any).allowSelfPosting === null
              ? undefined
              : Boolean((dto as any).allowSelfPosting),

        receiptBankName:
          (dto as any).receiptBankName === undefined
            ? undefined
            : (dto as any).receiptBankName === null
              ? null
              : String((dto as any).receiptBankName).trim() || null,
        receiptBankAccountName:
          (dto as any).receiptBankAccountName === undefined
            ? undefined
            : (dto as any).receiptBankAccountName === null
              ? null
              : String((dto as any).receiptBankAccountName).trim() || null,
        receiptBankAccountNumber:
          (dto as any).receiptBankAccountNumber === undefined
            ? undefined
            : (dto as any).receiptBankAccountNumber === null
              ? null
              : String((dto as any).receiptBankAccountNumber).trim() || null,
        receiptBankBranch:
          (dto as any).receiptBankBranch === undefined
            ? undefined
            : (dto as any).receiptBankBranch === null
              ? null
              : String((dto as any).receiptBankBranch).trim() || null,
        receiptBankSwiftCode:
          (dto as any).receiptBankSwiftCode === undefined
            ? undefined
            : (dto as any).receiptBankSwiftCode === null
              ? null
              : String((dto as any).receiptBankSwiftCode).trim() || null,

        requiresDepartmentOnInvoices:
          (dto as any).requiresDepartmentOnInvoices === undefined
            ? undefined
            : (dto as any).requiresDepartmentOnInvoices === null
              ? null
              : Boolean((dto as any).requiresDepartmentOnInvoices),
        requiresProjectOnInvoices:
          (dto as any).requiresProjectOnInvoices === undefined
            ? undefined
            : (dto as any).requiresProjectOnInvoices === null
              ? null
              : Boolean((dto as any).requiresProjectOnInvoices),
        requiresFundOnInvoices:
          (dto as any).requiresFundOnInvoices === undefined
            ? undefined
            : (dto as any).requiresFundOnInvoices === null
              ? null
              : Boolean((dto as any).requiresFundOnInvoices),

        arControlAccountId:
          (dto as any).arControlAccountId === undefined
            ? undefined
            : (dto as any).arControlAccountId === null
              ? null
              : String((dto as any).arControlAccountId).trim() || null,

        defaultBankClearingAccountId:
          (dto as any).defaultBankClearingAccountId === undefined
            ? undefined
            : (dto as any).defaultBankClearingAccountId === null
              ? null
              : String((dto as any).defaultBankClearingAccountId).trim() ||
                null,

        cashClearingAccountId:
          (dto as any).cashClearingAccountId === undefined
            ? undefined
            : (dto as any).cashClearingAccountId === null
              ? null
              : String((dto as any).cashClearingAccountId).trim() || null,

        unappliedReceiptsAccountId:
          (dto as any).unappliedReceiptsAccountId === undefined
            ? undefined
            : (dto as any).unappliedReceiptsAccountId === null
              ? null
              : String((dto as any).unappliedReceiptsAccountId).trim() || null,
      },
      select: {
        id: true,
        name: true,
        organisationName: true,
        organisationShortName: true,
        legalName: true,
        defaultCurrency: true,
        country: true,
        timezone: true,
        financialYearStartMonth: true,
        dateFormat: true,
        numberFormat: true,
        defaultLandingPage: true,
        defaultDashboard: true,
        defaultLanguage: true,
        demoModeEnabled: true,
        defaultUserRoleCode: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        secondaryAccentColor: true,
        allowSelfPosting: true,
        receiptBankName: true,
        receiptBankAccountName: true,
        receiptBankAccountNumber: true,
        receiptBankBranch: true,
        receiptBankSwiftCode: true,
        requiresDepartmentOnInvoices: true,
        requiresProjectOnInvoices: true,
        requiresFundOnInvoices: true,
        arControlAccountId: true,
        defaultBankClearingAccountId: true,
        cashClearingAccountId: true,
        unappliedReceiptsAccountId: true,
        updatedAt: true,
      },
    });

    const after = {
      organisationName: updated.organisationName,
      organisationShortName: updated.organisationShortName,
      legalName: updated.legalName,
      defaultCurrency: updated.defaultCurrency,
      country: updated.country,
      timezone: updated.timezone,
      financialYearStartMonth: updated.financialYearStartMonth,
      dateFormat: updated.dateFormat,
      numberFormat: updated.numberFormat,
      defaultLandingPage: updated.defaultLandingPage,
      defaultDashboard: updated.defaultDashboard,
      defaultLanguage: updated.defaultLanguage,
      demoModeEnabled: updated.demoModeEnabled,
      defaultUserRoleCode: updated.defaultUserRoleCode,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      accentColor: updated.accentColor,
      secondaryAccentColor: updated.secondaryAccentColor,
      allowSelfPosting: (updated as any).allowSelfPosting,
      receiptBankName: (updated as any).receiptBankName ?? null,
      receiptBankAccountName: (updated as any).receiptBankAccountName ?? null,
      receiptBankAccountNumber: (updated as any).receiptBankAccountNumber ?? null,
      receiptBankBranch: (updated as any).receiptBankBranch ?? null,
      receiptBankSwiftCode: (updated as any).receiptBankSwiftCode ?? null,
      requiresDepartmentOnInvoices: (updated as any).requiresDepartmentOnInvoices,
      requiresProjectOnInvoices: (updated as any).requiresProjectOnInvoices,
      requiresFundOnInvoices: (updated as any).requiresFundOnInvoices,
      arControlAccountId: (updated as any).arControlAccountId ?? null,
      defaultBankClearingAccountId:
        (updated as any).defaultBankClearingAccountId ?? null,
      cashClearingAccountId: (updated as any).cashClearingAccountId ?? null,
      unappliedReceiptsAccountId:
        (updated as any).unappliedReceiptsAccountId ?? null,
      faviconUrl: updated.faviconUrl,
      logoUrl: updated.logoUrl,
    };

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'ORGANISATION_UPDATE',
          entityType: 'TENANT',
          entityId: tenant.id,
          action: 'SYSTEM_CONFIG_UPDATE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({ before, after }),
          userId: user.id,
          permissionUsed: 'FINANCE_CONFIG_CHANGE',
        },
      })
      .catch(() => undefined);

    return {
      ...updated,
      logoUrl: updated.logoUrl ? '/settings/organisation/logo' : null,
      faviconUrl: updated.faviconUrl ? '/settings/system/favicon' : null,
    };
  }

  async uploadTenantFavicon(req: Request, file?: any) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing fileName');

    const mimeType = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_FAVICON_MIME.has(mimeType)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: png, svg, ico',
      );
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadId = randomUUID();
    const storageKey = `${tenant.id}/branding/${uploadId}_favicon_${safeName}`;

    await this.storage.put(storageKey, file.buffer);

    const before = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { faviconUrl: true },
    });

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { faviconUrl: storageKey },
      select: { faviconUrl: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'ORGANISATION_UPDATE',
          entityType: 'TENANT',
          entityId: tenant.id,
          action: 'SYSTEM_FAVICON_UPLOAD',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            before: { faviconUrl: before?.faviconUrl ?? null },
            after: { faviconUrl: updated.faviconUrl },
          }),
          userId: user.id,
          permissionUsed: 'SYSTEM_CONFIG_CHANGE',
        },
      })
      .catch(() => undefined);

    return { faviconUrl: '/settings/system/favicon' };
  }

  async downloadTenantFavicon(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { faviconUrl: true },
    });
    if (!row?.faviconUrl) throw new NotFoundException('No favicon uploaded');

    const buf = await this.storage.get(row.faviconUrl);
    const fileName = row.faviconUrl.split('/').pop() ?? 'favicon';

    const ext = fileName.toLowerCase().endsWith('.svg')
      ? 'image/svg+xml'
      : fileName.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/x-icon';

    return { body: buf, mimeType: ext, fileName };
  }

  async updateOrganisation(req: Request, dto: UpdateOrganisationDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const before = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        organisationName: true,
        organisationShortName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });

    if (!before) throw new NotFoundException('Tenant not found');

    const trimmedName = dto.organisationName?.trim();
    if (!trimmedName)
      throw new BadRequestException('organisationName is required');

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        organisationName: trimmedName,
        organisationShortName: dto.organisationShortName?.trim()
          ? dto.organisationShortName.trim()
          : null,
        primaryColor: dto.primaryColor ?? undefined,
        secondaryColor:
          dto.secondaryColor === undefined ? undefined : dto.secondaryColor,
      },
      select: {
        id: true,
        organisationName: true,
        organisationShortName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        updatedAt: true,
      },
    });

    const after = {
      organisationName: updated.organisationName,
      organisationShortName: updated.organisationShortName,
      logoUrl: updated.logoUrl,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
    };

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'ORGANISATION_UPDATE',
          entityType: 'TENANT',
          entityId: tenant.id,
          action: 'ORGANISATION_UPDATE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({ before, after }),
          userId: user.id,
          permissionUsed: 'SYSTEM_CONFIG_CHANGE',
        },
      })
      .catch(() => undefined);

    return {
      ...updated,
      logoUrl: updated.logoUrl ? '/settings/organisation/logo' : null,
    };
  }

  async uploadOrganisationLogo(req: Request, file?: any) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing fileName');

    const mimeType = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: png, jpg, svg',
      );
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadId = randomUUID();
    const storageKey = `${tenant.id}/branding/${uploadId}_${safeName}`;

    await this.storage.put(storageKey, file.buffer);

    const before = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { logoUrl: true },
    });

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: storageKey },
      select: { logoUrl: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'ORGANISATION_LOGO_UPLOAD',
          entityType: 'TENANT',
          entityId: tenant.id,
          action: 'ORGANISATION_LOGO_UPLOAD',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            before: { logoUrl: before?.logoUrl ?? null },
            after: { logoUrl: updated.logoUrl },
          }),
          userId: user.id,
          permissionUsed: 'ADMIN',
        },
      })
      .catch(() => undefined);

    return { logoUrl: '/settings/organisation/logo' };
  }

  async downloadOrganisationLogo(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { logoUrl: true },
    });
    if (!row?.logoUrl) throw new NotFoundException('No logo uploaded');

    const buf = await this.storage.get(row.logoUrl);
    const fileName = row.logoUrl.split('/').pop() ?? 'logo';

    const ext = fileName.toLowerCase().endsWith('.svg')
      ? 'image/svg+xml'
      : fileName.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    return { body: buf, mimeType: ext, fileName };
  }
}
