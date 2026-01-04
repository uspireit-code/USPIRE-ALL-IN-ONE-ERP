"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../prisma/prisma.service");
const permissions_decorator_1 = require("./permissions.decorator");
let PermissionsGuard = class PermissionsGuard {
    reflector;
    prisma;
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const requirement = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
        if (!requirement ||
            (Array.isArray(requirement) && requirement.length === 0)) {
            return true;
        }
        const required = Array.isArray(requirement)
            ? requirement
            : requirement.permissions;
        const mode = Array.isArray(requirement) ? 'all' : requirement.mode;
        const req = context.switchToHttp().getRequest();
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.ForbiddenException('Missing tenant or user context');
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
        const codes = new Set();
        for (const ur of userRoles) {
            for (const rp of ur.role.rolePermissions) {
                codes.add(rp.permission.code);
            }
        }
        if (mode === 'all') {
            const missing = required.filter((p) => !codes.has(p));
            if (missing.length > 0) {
                throw new common_1.ForbiddenException({
                    error: 'Access denied',
                    missingPermissions: missing,
                });
            }
        }
        else {
            const hasAny = required.some((p) => codes.has(p));
            if (!hasAny) {
                throw new common_1.ForbiddenException({
                    error: 'Access denied',
                    missingAnyOfPermissions: required,
                });
            }
        }
        const conflict = await this.findSoDConflict({
            tenantId: tenant.id,
            userId: user.id,
            requiredPermissions: required,
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
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                permissionAttempted: conflict.permissionAttempted,
                conflictingPermission: conflict.conflictingPermission,
            });
        }
        return true;
    }
    async findSoDConflict(params) {
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
                if (skipRulePairs.has(`${rule.forbiddenPermissionA}|${rule.forbiddenPermissionB}`)) {
                    continue;
                }
                if (rule.forbiddenPermissionA === attempted &&
                    params.userPermissionCodes.has(rule.forbiddenPermissionB)) {
                    return {
                        permissionAttempted: attempted,
                        conflictingPermission: rule.forbiddenPermissionB,
                    };
                }
                if (rule.forbiddenPermissionB === attempted &&
                    params.userPermissionCodes.has(rule.forbiddenPermissionA)) {
                    return {
                        permissionAttempted: attempted,
                        conflictingPermission: rule.forbiddenPermissionA,
                    };
                }
            }
        }
        return null;
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], PermissionsGuard);
//# sourceMappingURL=permissions.guard.js.map