import type { Request, Response } from 'express';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditEvidenceQueryDto } from './dto/audit-evidence-query.dto';
import { AuditEvidenceUploadDto } from './dto/audit-evidence-upload.dto';
export declare class AuditEvidenceController {
    private readonly evidence;
    constructor(evidence: AuditEvidenceService);
    upload(req: Request, file: any, dto: AuditEvidenceUploadDto, res: Response): Promise<void>;
    list(req: Request, dto: AuditEvidenceQueryDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        mimeType: string;
        sha256Hash: string;
        entityType: import("@prisma/client").$Enums.AuditEntityType;
        entityId: string;
        fileName: string;
        size: number;
        uploadedBy: {
            email: string;
            id: string;
        };
        uploadedById: string;
    }[]>;
    download(req: Request, id: string, res: Response): Promise<void>;
}
