import type { Request } from 'express';
import type { Response } from 'express';
import { DisclosureNotesAuditService } from './disclosure-notes-audit.service';
import { DisclosureNotesService } from './disclosure-notes.service';
import { DisclosureNoteGenerateDto } from './dto/disclosure-note-generate.dto';
import { DisclosureNoteListQueryDto } from './dto/disclosure-note-list.dto';
import { IfrsDisclosureNotesService } from './ifrs-disclosure-notes.service';
import { IfrsDisclosureNoteQueryDto } from './dto/ifrs-disclosure-note-query.dto';
import { ReportExportService } from './report-export.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class DisclosureNotesController {
    private readonly disclosureNotes;
    private readonly ifrsDisclosureNotes;
    private readonly exports;
    private readonly audit;
    private readonly prisma;
    constructor(disclosureNotes: DisclosureNotesService, ifrsDisclosureNotes: IfrsDisclosureNotesService, exports: ReportExportService, audit: DisclosureNotesAuditService, prisma: PrismaService);
    private getTenantPdfMetaOrThrow;
    generate(req: Request, dto: DisclosureNoteGenerateDto): Promise<{
        lines: {
            id: string;
            values: import("@prisma/client/runtime/library").JsonValue;
            label: string;
            orderIndex: number;
            disclosureNoteId: string;
            rowKey: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        generatedById: string;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    list(req: Request, dto: DisclosureNoteListQueryDto): Promise<{
        id: string;
        createdAt: Date;
        generatedById: string;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
    }[]>;
    listIfrs(): Promise<import("./ifrs-disclosure-notes.types").IfrsDisclosureNotesIndexItem[]>;
    getIfrs(req: Request, noteCode: string, dto: IfrsDisclosureNoteQueryDto): Promise<import("./ifrs-disclosure-notes.types").IfrsDisclosureNoteDto>;
    exportIfrs(req: Request, noteCode: string, dto: IfrsDisclosureNoteQueryDto, res: Response): Promise<void>;
    get(req: Request, id: string): Promise<{
        lines: {
            id: string;
            values: import("@prisma/client/runtime/library").JsonValue;
            label: string;
            orderIndex: number;
            disclosureNoteId: string;
            rowKey: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        generatedById: string;
        accountingPeriodId: string;
        noteType: import("@prisma/client").$Enums.DisclosureNoteType;
        generatedAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
