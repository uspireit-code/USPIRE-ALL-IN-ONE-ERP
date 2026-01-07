import type { Request } from 'express';
import { AuditService } from './audit.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
export declare class AuditController {
    private readonly audit;
    constructor(audit: AuditService);
    listEvents(req: Request, dto: AuditEventsQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        rows: {
            id: string;
            createdAt: Date;
            user: {
                id: string;
                email: string;
            };
            tenantId: string;
            reason: string | null;
            eventType: import("@prisma/client").$Enums.AuditEventType;
            entityType: import("@prisma/client").$Enums.AuditEntityType;
            entityId: string;
            action: string;
            outcome: import("@prisma/client").$Enums.AuditOutcome;
            permissionUsed: string | null;
        }[];
    }>;
}
