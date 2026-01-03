"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_provider_1 = require("../storage/storage.provider");
const node_crypto_1 = require("node:crypto");
const bcrypt = __importStar(require("bcrypt"));
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const ALLOWED_FAVICON_MIME = new Set([
    'image/png',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
]);
function inferModuleFromPermissionCode(code) {
    const c = (code || '').toLowerCase();
    if (c.startsWith('audit_') || c.startsWith('audit.'))
        return 'Audit';
    if (c.startsWith('fa_') || c.startsWith('fa.'))
        return 'Assets';
    if (c.startsWith('budget_') ||
        c.startsWith('forecast.') ||
        c.startsWith('dashboard.')) {
        return 'Planning';
    }
    if (c.startsWith('report.') ||
        c.includes('_tb_') ||
        c.includes('_trial_balance_') ||
        c.includes('_pl_') ||
        c.includes('_pnl_') ||
        c.includes('_profit') ||
        c.includes('_bs_') ||
        c.includes('_balance_sheet_') ||
        c.includes('_cash_flow_') ||
        c.includes('_soce_') ||
        c.includes('_aging_')) {
        return 'Reports';
    }
    if (c.startsWith('finance_') ||
        c.startsWith('ap_') ||
        c.startsWith('ar_') ||
        c.startsWith('bank_') ||
        c.startsWith('payment_') ||
        c.startsWith('tax_')) {
        return 'Accounting';
    }
    return 'Settings';
}
function permissionIsApprovalLike(code) {
    const c = (code || '').toLowerCase();
    return c.includes('approve') || c.includes('_approve');
}
function permissionIsReadOnlyLike(code) {
    const c = (code || '').toLowerCase();
    return c.includes('view') || c.includes('_view');
}
function inferIntendedUsers(roleName) {
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
let SettingsService = class SettingsService {
    prisma;
    storage;
    constructor(prisma, storage) {
        this.prisma = prisma;
        this.storage = storage;
    }
    async ensureAdminCoaPermissions(tenantId) {
        const adminRole = await this.prisma.role.findFirst({
            where: { tenantId, name: 'ADMIN' },
            select: { id: true },
        });
        if (!adminRole)
            return;
        const requiredPermissionCodes = [
            'FINANCE_COA_VIEW',
            'FINANCE_COA_UPDATE',
        ];
        const perms = await this.prisma.permission.findMany({
            where: { code: { in: [...requiredPermissionCodes] } },
            select: { id: true },
        });
        if (perms.length === 0)
            return;
        await this.prisma.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
            skipDuplicates: true,
        });
    }
    async ensureFinanceManagerRole(tenantId) {
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
            'FINANCE_TB_VIEW',
            'FINANCE_CASHFLOW_VIEW',
            'FINANCE_SOE_VIEW',
            'FINANCE_DISCLOSURE_VIEW',
            'report.view.pl',
            'report.view.bs',
            'FINANCE_REPORT_EXPORT',
        ];
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
        await this.prisma.rolePermission.deleteMany({
            where: {
                roleId: role.id,
                permission: { code: { notIn: [...allowedPermissionCodes] } },
            },
        });
    }
    async ensureFinanceControllerRole(tenantId) {
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
            'FINANCE_COA_VIEW',
            'FINANCE_COA_UPDATE',
            'FINANCE_BUDGET_VIEW',
            'FINANCE_TB_VIEW',
            'FINANCE_CASHFLOW_VIEW',
            'FINANCE_SOE_VIEW',
            'FINANCE_DISCLOSURE_VIEW',
            'report.view.pl',
            'report.view.bs',
            'FINANCE_REPORT_EXPORT',
        ];
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
        await this.prisma.rolePermission.deleteMany({
            where: {
                roleId: role.id,
                permission: { code: { notIn: [...allowedPermissionCodes] } },
            },
        });
    }
    async listRolesWithPermissions(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        await this.ensureFinanceManagerRole(tenant.id);
        await this.ensureFinanceControllerRole(tenant.id);
        await this.ensureAdminCoaPermissions(tenant.id);
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
        const permissionDescriptionByCode = new Map();
        for (const r of roles) {
            for (const rp of r.rolePermissions) {
                if (rp.permission.description) {
                    permissionDescriptionByCode.set(rp.permission.code, rp.permission.description);
                }
            }
        }
        return roles.map((r) => {
            const codes = r.rolePermissions.map((rp) => rp.permission.code);
            const codeSet = new Set(codes);
            const permissionsByModule = {
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
            const readOnly = codes.length > 0 && codes.every(permissionIsReadOnlyLike);
            const isAdmin = r.name === 'ADMIN';
            const controlRules = [];
            for (const rule of sodRules) {
                const aIn = codeSet.has(rule.forbiddenPermissionA);
                const bIn = codeSet.has(rule.forbiddenPermissionB);
                if (!aIn && !bIn)
                    continue;
                if (rule.description?.trim()) {
                    controlRules.push(rule.description.trim());
                    continue;
                }
                const aDesc = permissionDescriptionByCode.get(rule.forbiddenPermissionA) ??
                    'a restricted permission';
                const bDesc = permissionDescriptionByCode.get(rule.forbiddenPermissionB) ??
                    'a restricted permission';
                if (aIn && bIn) {
                    controlRules.push(`This role cannot include both: ${aDesc} and ${bDesc}.`);
                }
                else if (aIn) {
                    controlRules.push(`This role cannot be combined with another role that grants: ${bDesc}.`);
                }
                else {
                    controlRules.push(`This role cannot be combined with another role that grants: ${aDesc}.`);
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
    async getRoleDetails(req, id) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        if (!id)
            throw new common_1.BadRequestException('Missing role id');
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
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        const allPermissions = await this.prisma.permission.findMany({
            orderBy: { description: 'asc' },
            select: { code: true, description: true },
        });
        const assigned = new Set(role.rolePermissions.map((rp) => rp.permission.code));
        const permissionsByModule = {
            Accounting: [],
            Planning: [],
            Assets: [],
            Reports: [],
            Audit: [],
            Settings: [],
        };
        const permissionDescriptionByCode = new Map();
        for (const p of allPermissions) {
            if (p.description)
                permissionDescriptionByCode.set(p.code, p.description);
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
        const controlRules = [];
        for (const rule of sodRules) {
            const aIn = assigned.has(rule.forbiddenPermissionA);
            const bIn = assigned.has(rule.forbiddenPermissionB);
            if (!aIn && !bIn)
                continue;
            if (rule.description?.trim()) {
                controlRules.push(rule.description.trim());
                continue;
            }
            const aDesc = permissionDescriptionByCode.get(rule.forbiddenPermissionA) ??
                'a restricted permission';
            const bDesc = permissionDescriptionByCode.get(rule.forbiddenPermissionB) ??
                'a restricted permission';
            if (aIn && bIn) {
                controlRules.push(`This role cannot include both: ${aDesc} and ${bDesc}.`);
            }
            else if (aIn) {
                controlRules.push(`This role cannot be combined with another role that grants: ${bDesc}.`);
            }
            else {
                controlRules.push(`This role cannot be combined with another role that grants: ${aDesc}.`);
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
    async listUsers(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
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
            status: u.isActive ? 'ACTIVE' : 'INACTIVE',
            roles: u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
            createdAt: u.createdAt,
        }));
    }
    async listRoles(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        await this.ensureFinanceManagerRole(tenant.id);
        await this.ensureFinanceControllerRole(tenant.id);
        const roles = await this.prisma.role.findMany({
            where: { tenantId: tenant.id },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true, createdAt: true },
        });
        return roles;
    }
    async validateRoles(req, dto) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const roleIds = Array.from(new Set(dto.roleIds ?? []));
        const roles = await this.prisma.role.findMany({
            where: { tenantId: tenant.id, id: { in: roleIds } },
            select: { id: true },
        });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more roles are invalid');
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
    async createUser(req, dto) {
        const tenant = req.tenant;
        const actor = req.user;
        if (!tenant || !actor)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const name = dto.name.trim();
        if (!name)
            throw new common_1.BadRequestException('name is required');
        const email = dto.email.toLowerCase().trim();
        if (!email)
            throw new common_1.BadRequestException('email is required');
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
            throw new common_1.BadRequestException('A user with this email already exists');
        }
        const temporaryPassword = dto.temporaryPassword?.trim()
            ? dto.temporaryPassword.trim()
            : `Temp-${(0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 12)}!`;
        const roundsRaw = process.env.BCRYPT_SALT_ROUNDS ?? '12';
        const rounds = Number(roundsRaw);
        if (!Number.isFinite(rounds) || rounds < 4) {
            throw new common_1.BadRequestException('Invalid BCRYPT_SALT_ROUNDS');
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return {
            id: created.id,
            name: created.name,
            email: created.email,
            status: created.isActive ? 'ACTIVE' : 'INACTIVE',
            createdAt: created.createdAt,
            temporaryPassword,
        };
    }
    async updateUserStatus(req, id, dto) {
        const tenant = req.tenant;
        const actor = req.user;
        if (!tenant || !actor)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        if (actor.id === id) {
            throw new common_1.BadRequestException('You cannot change your own status');
        }
        const target = await this.prisma.user.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, isActive: true },
        });
        if (!target)
            throw new common_1.NotFoundException('User not found');
        const nextIsActive = dto.isActive;
        if (target.isActive && !nextIsActive) {
            const remainingAdmins = await this.countActiveAdminsExcludingUser({
                tenantId: tenant.id,
                excludeUserId: id,
            });
            if (remainingAdmins === 0) {
                throw new common_1.BadRequestException('Cannot deactivate the last active admin');
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            status: updated.isActive ? 'ACTIVE' : 'INACTIVE',
            createdAt: updated.createdAt,
        };
    }
    async updateUserRoles(req, id, dto) {
        const tenant = req.tenant;
        const actor = req.user;
        if (!tenant || !actor)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!id)
            throw new common_1.BadRequestException('Missing user id');
        await this.prisma.user
            .findFirst({ where: { id, tenantId: tenant.id }, select: { id: true } })
            .then((u) => {
            if (!u)
                throw new common_1.NotFoundException('User not found');
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return out;
    }
    async applyUserRoles(params) {
        const uniqueRoleIds = Array.from(new Set(params.roleIds));
        const roles = await this.prisma.role.findMany({
            where: { tenantId: params.tenantId, id: { in: uniqueRoleIds } },
            select: { id: true, name: true },
        });
        if (roles.length !== uniqueRoleIds.length) {
            throw new common_1.BadRequestException('One or more roles are invalid');
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
                throw new common_1.BadRequestException('You cannot remove your own admin role');
            }
        }
        if (beforeRoleNames.has('ADMIN') && !afterRoleNames.has('ADMIN')) {
            const remainingAdmins = await this.countActiveAdminsExcludingUser({
                tenantId: params.tenantId,
                excludeUserId: params.targetUserId,
            });
            if (remainingAdmins === 0) {
                throw new common_1.BadRequestException('Cannot remove admin role from the last active admin');
            }
        }
        const sodConflict = await this.findSoDConflictForRoles({
            tenantId: params.tenantId,
            roleIds: roles.map((r) => r.id),
        });
        if (sodConflict) {
            throw new common_1.ForbiddenException({
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
    async countActiveAdminsExcludingUser(params) {
        const adminRole = await this.prisma.role.findFirst({
            where: { tenantId: params.tenantId, name: 'ADMIN' },
            select: { id: true },
        });
        if (!adminRole)
            return 0;
        return this.prisma.userRole.count({
            where: {
                roleId: adminRole.id,
                userId: { not: params.excludeUserId },
                user: { tenantId: params.tenantId, isActive: true },
            },
        });
    }
    async findSoDConflictForRoles(params) {
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
        if (codes.size === 0)
            return null;
        const rules = await this.prisma.soDRule.findMany({
            where: { tenantId: params.tenantId },
            select: { forbiddenPermissionA: true, forbiddenPermissionB: true },
        });
        const conflicts = [];
        for (const rule of rules) {
            if (codes.has(rule.forbiddenPermissionA) &&
                codes.has(rule.forbiddenPermissionB)) {
                conflicts.push({
                    permissionA: rule.forbiddenPermissionA,
                    permissionB: rule.forbiddenPermissionB,
                });
            }
        }
        return conflicts.length > 0 ? conflicts : null;
    }
    async getOrganisation(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
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
        if (!row)
            throw new common_1.NotFoundException('Tenant not found');
        return {
            ...row,
            logoUrl: row.logoUrl ? '/settings/organisation/logo' : null,
        };
    }
    async getSystemConfig(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const row = await this.prisma.tenant.findUnique({
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
                arControlAccountId: true,
                defaultBankClearingAccountId: true,
                unappliedReceiptsAccountId: true,
                updatedAt: true,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Tenant not found');
        return {
            ...row,
            logoUrl: row.logoUrl ? '/settings/organisation/logo' : null,
            faviconUrl: row.faviconUrl ? '/settings/system/favicon' : null,
        };
    }
    async updateSystemConfig(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const before = await this.prisma.tenant.findUnique({
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
                arControlAccountId: true,
                defaultBankClearingAccountId: true,
                unappliedReceiptsAccountId: true,
                faviconUrl: true,
                logoUrl: true,
            },
        });
        if (!before)
            throw new common_1.NotFoundException('Tenant not found');
        if (dto.financialYearStartMonth !== undefined &&
            dto.financialYearStartMonth !== null) {
            if (dto.financialYearStartMonth < 1 || dto.financialYearStartMonth > 12) {
                throw new common_1.BadRequestException('financialYearStartMonth must be between 1 and 12');
            }
        }
        const updated = await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                organisationName: dto.organisationName === undefined
                    ? undefined
                    : dto.organisationName === null
                        ? undefined
                        : dto.organisationName.trim(),
                organisationShortName: dto.organisationShortName === undefined
                    ? undefined
                    : dto.organisationShortName === null
                        ? null
                        : dto.organisationShortName.trim() || null,
                legalName: dto.legalName === undefined
                    ? undefined
                    : dto.legalName === null
                        ? null
                        : dto.legalName.trim() || null,
                defaultCurrency: dto.defaultCurrency === undefined
                    ? undefined
                    : dto.defaultCurrency === null
                        ? null
                        : dto.defaultCurrency.trim() || null,
                country: dto.country === undefined
                    ? undefined
                    : dto.country === null
                        ? null
                        : dto.country.trim() || null,
                timezone: dto.timezone === undefined
                    ? undefined
                    : dto.timezone === null
                        ? null
                        : dto.timezone.trim() || null,
                financialYearStartMonth: dto.financialYearStartMonth === undefined
                    ? undefined
                    : dto.financialYearStartMonth,
                dateFormat: dto.dateFormat === undefined
                    ? undefined
                    : dto.dateFormat === null
                        ? null
                        : dto.dateFormat.trim() || null,
                numberFormat: dto.numberFormat === undefined
                    ? undefined
                    : dto.numberFormat === null
                        ? null
                        : dto.numberFormat.trim() || null,
                defaultLandingPage: dto.defaultLandingPage === undefined
                    ? undefined
                    : dto.defaultLandingPage === null
                        ? null
                        : dto.defaultLandingPage.trim() || null,
                defaultDashboard: dto.defaultDashboard === undefined
                    ? undefined
                    : dto.defaultDashboard === null
                        ? null
                        : dto.defaultDashboard.trim() || null,
                defaultLanguage: dto.defaultLanguage === undefined
                    ? undefined
                    : dto.defaultLanguage === null
                        ? null
                        : dto.defaultLanguage.trim() || null,
                demoModeEnabled: dto.demoModeEnabled === undefined ? undefined : dto.demoModeEnabled,
                defaultUserRoleCode: dto.defaultUserRoleCode === undefined
                    ? undefined
                    : dto.defaultUserRoleCode === null
                        ? null
                        : dto.defaultUserRoleCode.trim() || null,
                primaryColor: dto.primaryColor === undefined
                    ? undefined
                    : dto.primaryColor === null
                        ? undefined
                        : dto.primaryColor.trim() || undefined,
                secondaryColor: dto.secondaryColor === undefined
                    ? undefined
                    : dto.secondaryColor === null
                        ? null
                        : dto.secondaryColor.trim() || null,
                accentColor: dto.accentColor === undefined
                    ? undefined
                    : dto.accentColor === null
                        ? null
                        : dto.accentColor.trim() || null,
                secondaryAccentColor: dto.secondaryAccentColor === undefined
                    ? undefined
                    : dto.secondaryAccentColor === null
                        ? null
                        : dto.secondaryAccentColor.trim() || null,
                allowSelfPosting: dto.allowSelfPosting === undefined
                    ? undefined
                    : dto.allowSelfPosting === null
                        ? undefined
                        : Boolean(dto.allowSelfPosting),
                receiptBankName: dto.receiptBankName === undefined
                    ? undefined
                    : dto.receiptBankName === null
                        ? null
                        : String(dto.receiptBankName).trim() || null,
                receiptBankAccountName: dto.receiptBankAccountName === undefined
                    ? undefined
                    : dto.receiptBankAccountName === null
                        ? null
                        : String(dto.receiptBankAccountName).trim() || null,
                receiptBankAccountNumber: dto.receiptBankAccountNumber === undefined
                    ? undefined
                    : dto.receiptBankAccountNumber === null
                        ? null
                        : String(dto.receiptBankAccountNumber).trim() || null,
                receiptBankBranch: dto.receiptBankBranch === undefined
                    ? undefined
                    : dto.receiptBankBranch === null
                        ? null
                        : String(dto.receiptBankBranch).trim() || null,
                receiptBankSwiftCode: dto.receiptBankSwiftCode === undefined
                    ? undefined
                    : dto.receiptBankSwiftCode === null
                        ? null
                        : String(dto.receiptBankSwiftCode).trim() || null,
                arControlAccountId: dto.arControlAccountId === undefined
                    ? undefined
                    : dto.arControlAccountId === null
                        ? null
                        : String(dto.arControlAccountId).trim() || null,
                defaultBankClearingAccountId: dto.defaultBankClearingAccountId === undefined
                    ? undefined
                    : dto.defaultBankClearingAccountId === null
                        ? null
                        : String(dto.defaultBankClearingAccountId).trim() ||
                            null,
                unappliedReceiptsAccountId: dto.unappliedReceiptsAccountId === undefined
                    ? undefined
                    : dto.unappliedReceiptsAccountId === null
                        ? null
                        : String(dto.unappliedReceiptsAccountId).trim() || null,
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
                arControlAccountId: true,
                defaultBankClearingAccountId: true,
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
            allowSelfPosting: updated.allowSelfPosting,
            receiptBankName: updated.receiptBankName ?? null,
            receiptBankAccountName: updated.receiptBankAccountName ?? null,
            receiptBankAccountNumber: updated.receiptBankAccountNumber ?? null,
            receiptBankBranch: updated.receiptBankBranch ?? null,
            receiptBankSwiftCode: updated.receiptBankSwiftCode ?? null,
            arControlAccountId: updated.arControlAccountId ?? null,
            defaultBankClearingAccountId: updated.defaultBankClearingAccountId ?? null,
            unappliedReceiptsAccountId: updated.unappliedReceiptsAccountId ?? null,
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return {
            ...updated,
            logoUrl: updated.logoUrl ? '/settings/organisation/logo' : null,
            faviconUrl: updated.faviconUrl ? '/settings/system/favicon' : null,
        };
    }
    async uploadTenantFavicon(req, file) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!file.originalname)
            throw new common_1.BadRequestException('Missing fileName');
        const mimeType = (file.mimetype || '').toLowerCase();
        if (!ALLOWED_FAVICON_MIME.has(mimeType)) {
            throw new common_1.BadRequestException('Invalid file type. Allowed: png, svg, ico');
        }
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadId = (0, node_crypto_1.randomUUID)();
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return { faviconUrl: '/settings/system/favicon' };
    }
    async downloadTenantFavicon(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const row = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: { faviconUrl: true },
        });
        if (!row?.faviconUrl)
            throw new common_1.NotFoundException('No favicon uploaded');
        const buf = await this.storage.get(row.faviconUrl);
        const fileName = row.faviconUrl.split('/').pop() ?? 'favicon';
        const ext = fileName.toLowerCase().endsWith('.svg')
            ? 'image/svg+xml'
            : fileName.toLowerCase().endsWith('.png')
                ? 'image/png'
                : 'image/x-icon';
        return { body: buf, mimeType: ext, fileName };
    }
    async updateOrganisation(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
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
        if (!before)
            throw new common_1.NotFoundException('Tenant not found');
        const trimmedName = dto.organisationName?.trim();
        if (!trimmedName)
            throw new common_1.BadRequestException('organisationName is required');
        const updated = await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
                organisationName: trimmedName,
                organisationShortName: dto.organisationShortName?.trim()
                    ? dto.organisationShortName.trim()
                    : null,
                primaryColor: dto.primaryColor ?? undefined,
                secondaryColor: dto.secondaryColor === undefined ? undefined : dto.secondaryColor,
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
                permissionUsed: 'ADMIN',
            },
        })
            .catch(() => undefined);
        return {
            ...updated,
            logoUrl: updated.logoUrl ? '/settings/organisation/logo' : null,
        };
    }
    async uploadOrganisationLogo(req, file) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!file.originalname)
            throw new common_1.BadRequestException('Missing fileName');
        const mimeType = (file.mimetype || '').toLowerCase();
        if (!ALLOWED_MIME.has(mimeType)) {
            throw new common_1.BadRequestException('Invalid file type. Allowed: png, jpg, svg');
        }
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadId = (0, node_crypto_1.randomUUID)();
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
    async downloadOrganisationLogo(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const row = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: { logoUrl: true },
        });
        if (!row?.logoUrl)
            throw new common_1.NotFoundException('No logo uploaded');
        const buf = await this.storage.get(row.logoUrl);
        const fileName = row.logoUrl.split('/').pop() ?? 'logo';
        const ext = fileName.toLowerCase().endsWith('.svg')
            ? 'image/svg+xml'
            : fileName.toLowerCase().endsWith('.png')
                ? 'image/png'
                : 'image/jpeg';
        return { body: buf, mimeType: ext, fileName };
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_2.Inject)(storage_provider_1.STORAGE_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], SettingsService);
//# sourceMappingURL=settings.service.js.map