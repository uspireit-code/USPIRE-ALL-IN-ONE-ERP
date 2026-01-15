import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPresentationService } from '../reports/report-presentation.service';
import { type StorageProvider } from '../storage/storage.provider';
import { GlService } from './gl.service';
export declare class ReviewPackService {
    private readonly prisma;
    private readonly gl;
    private readonly reports;
    private readonly storage;
    private readonly rootDir;
    constructor(prisma: PrismaService, gl: GlService, reports: ReportPresentationService, storage: StorageProvider);
    private resolvePath;
    private sha256;
    private jsonBuf;
    private toSafeFileName;
    listReviewPacks(req: Request, periodId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        storageKey: string;
        periodId: string;
        generatedById: string;
        generatedBy: {
            id: string;
            email: string;
        };
        zipSize: number;
        zipSha256Hash: string;
        manifestSha256: string;
    }[]>;
    generateReviewPack(req: Request, periodId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        storageKey: string;
        periodId: string;
        generatedBy: {
            id: string;
            email: string;
        };
        zipSize: number;
        zipSha256Hash: string;
        manifestSha256: string;
    }>;
    downloadReviewPack(req: Request, periodId: string, packId: string): Promise<{
        fileName: string;
        body: NonSharedBuffer;
        size: number;
    }>;
}
