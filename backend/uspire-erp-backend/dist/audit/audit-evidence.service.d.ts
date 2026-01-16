import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageProvider } from '../storage/storage.provider';
import { AuditEvidenceQueryDto } from './dto/audit-evidence-query.dto';
import { AuditEvidenceUploadDto } from './dto/audit-evidence-upload.dto';
export declare class AuditEvidenceService {
    private readonly prisma;
    private readonly storage;
    constructor(prisma: PrismaService, storage: StorageProvider);
    uploadEvidence(req: Request, dto: AuditEvidenceUploadDto, file?: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        mimeType: string;
        storageKey: string;
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
    }>;
    listEvidence(req: Request, dto: AuditEvidenceQueryDto): Promise<{
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
    downloadEvidence(req: Request, id: string): Promise<{
        fileName: string;
        mimeType: string;
        size: number;
        body: Buffer<ArrayBufferLike>;
    }>;
}
