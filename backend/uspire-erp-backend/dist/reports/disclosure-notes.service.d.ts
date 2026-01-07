import { Prisma, type DisclosureNoteType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class DisclosureNotesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private round2;
    generateNote(req: Request, periodId: string, noteType: DisclosureNoteType): Promise<{
        lines: {
            id: string;
            values: Prisma.JsonValue;
            orderIndex: number;
            disclosureNoteId: string;
            rowKey: string;
            label: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
        generatedById: string;
        metadata: Prisma.JsonValue | null;
    }>;
    private generateDepreciationNote;
    private generateTaxReconciliationNote;
    private generatePpeMovementNote;
    listNotes(req: Request, periodId: string): Promise<{
        id: string;
        createdAt: Date;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
        generatedById: string;
    }[]>;
    getNote(req: Request, noteId: string): Promise<{
        lines: {
            id: string;
            values: Prisma.JsonValue;
            orderIndex: number;
            disclosureNoteId: string;
            rowKey: string;
            label: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
        generatedById: string;
        metadata: Prisma.JsonValue | null;
    }>;
}
