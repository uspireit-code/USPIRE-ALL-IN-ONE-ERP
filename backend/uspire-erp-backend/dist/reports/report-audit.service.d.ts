import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class ReportAuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    reportView(params: {
        req: Request;
        entityId: string;
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
    reportExport(params: {
        req: Request;
        entityId: string;
        permissionUsed: string;
        format: 'PDF' | 'CSV' | 'XLSX';
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
