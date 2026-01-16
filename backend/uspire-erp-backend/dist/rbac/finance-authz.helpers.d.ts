import type { AccountingPeriodStatus, SoDRule } from '@prisma/client';
export type AuthzUserLike = {
    id: string;
    permissionCodes: Set<string>;
};
export declare function requirePermission(user: AuthzUserLike, permission: string): void;
export declare function requireAnyPermission(user: AuthzUserLike, permissions: string[]): void;
export declare function requireOwnership(params: {
    createdById: string;
    userId: string;
    message?: string;
}): void;
export type SoDSeparationRule = {
    label: string;
    aUserId: string | null | undefined;
    bUserId: string | null | undefined;
};
export declare function requireSoDSeparation(rule: SoDSeparationRule): void;
export declare function detectSoDConflictFromRules(params: {
    requiredPermissions: string[];
    userPermissionCodes: Set<string>;
    rules: Array<Pick<SoDRule, 'forbiddenPermissionA' | 'forbiddenPermissionB'>>;
}): null | {
    permissionAttempted: string;
    conflictingPermission: string;
};
export declare function requirePeriodOpen(params: {
    status: AccountingPeriodStatus;
    periodName?: string;
}): void;
export type AuditStubEvent = {
    type: string;
    payload: Record<string, any>;
};
export declare function auditEventStub(_event: AuditStubEvent): Promise<void>;
