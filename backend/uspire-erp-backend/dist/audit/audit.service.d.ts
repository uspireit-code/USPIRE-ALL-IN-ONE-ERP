import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listEvents(req: Request, dto: AuditEventsQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        rows: {
            id: string;
            tenantId: string;
            createdAt: Date;
            user: {
                id: string;
                email: string;
            };
            eventType: import("@prisma/client").$Enums.AuditEventType;
            entityType: import("@prisma/client").$Enums.AuditEntityType;
            entityId: string;
            action: string;
            outcome: import("@prisma/client").$Enums.AuditOutcome;
            reason: string | null;
            permissionUsed: string | null;
        }[];
    }>;
}
