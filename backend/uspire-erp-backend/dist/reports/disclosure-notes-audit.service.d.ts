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
    }): Promise<void>;
    disclosureNoteView(params: {
        req: Request;
        noteId: string;
        permissionUsed: string;
        outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
        reason?: string;
    }): Promise<void>;
}
