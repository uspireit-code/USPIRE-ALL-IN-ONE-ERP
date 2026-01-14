import type { AuditOutcome } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditEventPayload } from './audit-contract';

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`writeAuditEvent validation failed: ${label} is required`);
  }
}

function safeJsonStringify(value: any) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: 'metadata_serialization_failed' });
  }
}

export async function writeAuditEvent(payload: AuditEventPayload): Promise<void> {
  return writeAuditEventWithPrisma(payload, undefined);
}

export async function writeAuditEventWithPrisma(
  payload: AuditEventPayload,
  prisma: PrismaService | undefined,
): Promise<void> {
  if (!payload) {
    throw new Error('writeAuditEvent validation failed: payload is required');
  }

  assertNonEmptyString(payload.tenantId, 'tenantId');
  assertNonEmptyString(payload.actorUserId, 'actorUserId');
  assertNonEmptyString(payload.entityId, 'entityId');

  if (!payload.entityType) {
    throw new Error('writeAuditEvent validation failed: entityType is required');
  }
  if (!payload.eventType) {
    throw new Error('writeAuditEvent validation failed: eventType is required');
  }

  const ts = payload.timestamp instanceof Date ? payload.timestamp : new Date();
  const outcome = (payload.outcome ?? 'SUCCESS') as AuditOutcome;

  const baseMeta = {
    ...(payload.metadata ?? {}),
    lifecycleType: payload.lifecycleType ?? null,
    timestamp: ts.toISOString(),
  };

  const reasonParts: any = {
    ...(payload.reason ? { reason: payload.reason } : {}),
    ...(Object.keys(baseMeta).length > 0 ? { metadata: baseMeta } : {}),
  };

  const reason = Object.keys(reasonParts).length > 0 ? safeJsonStringify(reasonParts) : undefined;

  if (!prisma) {
    // Intentionally no-op if Prisma isn't available in the current call site.
    // This mirrors the existing pattern of best-effort audit logging.
    return;
  }

  await prisma.auditEvent
    .create({
      data: {
        tenantId: payload.tenantId,
        eventType: payload.eventType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action ?? payload.permissionUsed ?? String(payload.eventType),
        outcome,
        reason: reason ?? null,
        userId: payload.actorUserId,
        permissionUsed: payload.permissionUsed ?? null,
      },
    })
    .catch(() => undefined);
}
