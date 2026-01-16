import type { PrismaService } from '../prisma/prisma.service';
import type { AuditEventPayload } from './audit-contract';
export declare function writeAuditEvent(payload: AuditEventPayload): Promise<void>;
export declare function writeAuditEventWithPrisma(payload: AuditEventPayload, prisma: PrismaService | undefined): Promise<void>;
