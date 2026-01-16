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
    }): Promise<void>;
    reportExport(params: {
        req: Request;
        entityId: string;
        permissionUsed: string;
        format: 'PDF' | 'CSV' | 'XLSX';
        outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
        reason?: string;
    }): Promise<void>;
}
