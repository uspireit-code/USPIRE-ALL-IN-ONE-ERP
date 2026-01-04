"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.requireOwnership = requireOwnership;
exports.requireSoDSeparation = requireSoDSeparation;
exports.detectSoDConflictFromRules = detectSoDConflictFromRules;
exports.requirePeriodOpen = requirePeriodOpen;
exports.auditEventStub = auditEventStub;
const common_1 = require("@nestjs/common");
function requirePermission(user, permission) {
    if (!user.permissionCodes.has(permission)) {
        throw new common_1.ForbiddenException({
            error: 'Access denied',
            missingPermission: permission,
        });
    }
}
function requireAnyPermission(user, permissions) {
    const ok = permissions.some((p) => user.permissionCodes.has(p));
    if (!ok) {
        throw new common_1.ForbiddenException({
            error: 'Access denied',
            missingAnyOf: permissions,
        });
    }
}
function requireOwnership(params) {
    if (params.createdById !== params.userId) {
        throw new common_1.ForbiddenException(params.message ?? 'Only the creator can perform this action');
    }
}
function requireSoDSeparation(rule) {
    const a = rule.aUserId ?? null;
    const b = rule.bUserId ?? null;
    if (!a || !b)
        return;
    if (a === b) {
        throw new common_1.ForbiddenException({
            error: 'Action blocked by Segregation of Duties (SoD)',
            reason: `${rule.label}: users must be different`,
        });
    }
}
function detectSoDConflictFromRules(params) {
    for (const attempted of params.requiredPermissions) {
        for (const rule of params.rules) {
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
function requirePeriodOpen(params) {
    if (params.status !== 'OPEN') {
        throw new common_1.ForbiddenException({
            error: 'Action blocked by accounting period control',
            reason: params.periodName
                ? `Accounting period is not OPEN: ${params.periodName}`
                : 'Accounting period is not OPEN',
        });
    }
}
async function auditEventStub(_event) {
    return;
}
//# sourceMappingURL=finance-authz.helpers.js.map