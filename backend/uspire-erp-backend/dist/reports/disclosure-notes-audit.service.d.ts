import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class DisclosureNotesAuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    disclosureNoteGenerate(params: {
        req: Request;
        noteId: string;
        permissionUsed: string;
        outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
        reason?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        reason: string | null;
        userId: string;
        eventType: import("@prisma/client").$Enums.AuditEventType;
        entityType: import("@prisma/client").$Enums.AuditEntityType;
        entityId: string;
        action: string;
        outcome: import("@prisma/client").$Enums.AuditOutcome;
        permissionUsed: string | null;
        forecastId: string | null;
        forecastVersionId: string | null;
    }>;
    disclosureNoteView(params: {
        req: Request;
        noteId: string;
        permissionUsed: string;
        outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
        reason?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        reason: string | null;
        userId: string;
        eventType: import("@prisma/client").$Enums.AuditEventType;
        entityType: import("@prisma/client").$Enums.AuditEntityType;
        entityId: string;
        action: string;
        outcome: import("@prisma/client").$Enums.AuditOutcome;
        permissionUsed: string | null;
        forecastId: string | null;
        forecastVersionId: string | null;
    }>;
}
