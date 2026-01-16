import type { AuditEntityType, AuditEventType, AuditOutcome } from '@prisma/client';
export type GenericLifecycleEventType = 'CREATE' | 'UPDATE' | 'SUBMIT' | 'APPROVE' | 'REVIEW' | 'REJECT' | 'POST' | 'POST_REVERSAL' | 'PARK' | 'VOID' | 'REVERSE' | 'ASSIGN_REVERSAL' | 'INITIATE_REVERSAL' | 'APPROVE_REVERSAL' | 'RETURN_TO_REVIEW' | 'GENERATE' | 'PERIOD_OPEN' | 'PERIOD_CLOSE' | 'PERIOD_REOPEN' | 'PERIOD_CORRECT' | 'SOD_VIOLATION';
export interface AuditEventPayload {
    tenantId: string;
    eventType: AuditEventType;
    actorUserId: string;
    entityType: AuditEntityType;
    entityId: string;
    timestamp: Date;
    permissionUsed?: string;
    reason?: string;
    metadata?: Record<string, any>;
    lifecycleType?: GenericLifecycleEventType;
    outcome?: AuditOutcome;
    action?: string;
}
