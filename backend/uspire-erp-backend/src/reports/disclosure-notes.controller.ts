import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { TimeoutInterceptor } from '../internal/timeout.interceptor';
import { TenantRateLimitGuard } from '../internal/tenant-rate-limit.guard';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { DisclosureNotesAuditService } from './disclosure-notes-audit.service';
import { DisclosureNotesService } from './disclosure-notes.service';
import { DisclosureNoteGenerateDto } from './dto/disclosure-note-generate.dto';
import { DisclosureNoteListQueryDto } from './dto/disclosure-note-list.dto';
import { IfrsDisclosureNotesService } from './ifrs-disclosure-notes.service';
import { IfrsDisclosureNoteQueryDto } from './dto/ifrs-disclosure-note-query.dto';
import { ReportExportService } from './report-export.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reports/disclosure-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseGuards(new TenantRateLimitGuard(10_000, 30, 'disclosure-notes'))
@UseInterceptors(new TimeoutInterceptor(15_000, 'DisclosureNotes'))
export class DisclosureNotesController {
  constructor(
    private readonly disclosureNotes: DisclosureNotesService,
    private readonly ifrsDisclosureNotes: IfrsDisclosureNotesService,
    private readonly exports: ReportExportService,
    private readonly audit: DisclosureNotesAuditService,
    private readonly prisma: PrismaService,
  ) {}

  private getTenantPdfMetaOrThrow(req: Request) {
    const tenant: any = (req as any).tenant;
    const entityLegalName = String(tenant?.legalName ?? '').trim();
    if (!entityLegalName) {
      throw new BadRequestException(
        'Missing Entity Legal Name in Tenant settings. Configure Settings → Tenant → Legal Name before exporting.',
      );
    }
    const currencyIsoCode = String(tenant?.defaultCurrency ?? '').trim();
    if (!currencyIsoCode) {
      throw new BadRequestException(
        'Missing default currency in Tenant settings. Configure Settings → Tenant → Default Currency before exporting.',
      );
    }
    return { entityLegalName, currencyIsoCode };
  }

  @Post('generate')
  @Permissions(PERMISSIONS.REPORT.DISCLOSURE_GENERATE)
  async generate(@Req() req: Request, @Body() dto: DisclosureNoteGenerateDto) {
    try {
      const note = await this.disclosureNotes.generateNote(
        req,
        dto.periodId,
        dto.noteType,
      );

      await this.audit
        .disclosureNoteGenerate({
          req,
          noteId: note.id,
          permissionUsed: PERMISSIONS.REPORT.DISCLOSURE_GENERATE,
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            periodId: dto.periodId,
            noteType: dto.noteType,
          }),
        })
        .catch(() => undefined);

      return note;
    } catch (e: any) {
      const outcome = e instanceof BadRequestException ? 'BLOCKED' : 'FAILED';
      const msg =
        e instanceof HttpException
          ? ((e.getResponse() as any)?.message ??
            (e.getResponse() as any)?.error)
          : undefined;

      await this.audit
        .disclosureNoteGenerate({
          req,
          noteId: `period:${dto.periodId}:type:${dto.noteType}`,
          permissionUsed: PERMISSIONS.REPORT.DISCLOSURE_GENERATE,
          outcome,
          reason: JSON.stringify({
            periodId: dto.periodId,
            noteType: dto.noteType,
            error: typeof msg === 'string' ? msg : undefined,
          }),
        })
        .catch(() => undefined);

      throw e;
    }
  }

  @Get()
  @Permissions(PERMISSIONS.REPORT.DISCLOSURE_VIEW)
  async list(@Req() req: Request, @Query() dto: DisclosureNoteListQueryDto) {
    return this.disclosureNotes.listNotes(req, dto.periodId);
  }

  @Get('ifrs')
  @Permissions(PERMISSIONS.REPORT.DISCLOSURE_VIEW)
  async listIfrs() {
    return this.ifrsDisclosureNotes.listNotes();
  }

  @Get('ifrs/:noteCode')
  @Permissions(PERMISSIONS.REPORT.DISCLOSURE_VIEW)
  async getIfrs(
    @Req() req: Request,
    @Param('noteCode') noteCode: string,
    @Query() dto: IfrsDisclosureNoteQueryDto,
  ) {
    const code = String(noteCode ?? '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    if (!allowed.has(code)) {
      throw new BadRequestException(
        'Invalid IFRS note code. Expected one of: A, B, C, D, E, F, G, H.',
      );
    }

    const note = await this.ifrsDisclosureNotes.generateNote(req, {
      periodId: dto.periodId,
      noteCode: code as any,
    });

    return note;
  }

  @Get('ifrs/:noteCode/export')
  @Permissions(PERMISSIONS.REPORT.REPORT_EXPORT, PERMISSIONS.REPORT.DISCLOSURE_VIEW)
  async exportIfrs(
    @Req() req: Request,
    @Param('noteCode') noteCode: string,
    @Query() dto: IfrsDisclosureNoteQueryDto,
    @Res() res: Response,
  ) {
    const code = String(noteCode ?? '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    if (!allowed.has(code)) {
      throw new BadRequestException(
        'Invalid IFRS note code. Expected one of: A, B, C, D, E, F, G, H.',
      );
    }

    const note = await this.ifrsDisclosureNotes.generateNote(req, {
      periodId: dto.periodId,
      noteCode: code as any,
    });

    const tenant: any = (req as any).tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: dto.periodId, tenantId: tenant.id },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!period) throw new BadRequestException('Accounting period not found');

    const from = new Date(period.startDate).toISOString().slice(0, 10);
    const to = new Date(period.endDate).toISOString().slice(0, 10);

    const { entityLegalName, currencyIsoCode } =
      this.getTenantPdfMetaOrThrow(req);

    const body = await this.exports.ifrsDisclosureNoteToPdf({
      note: note as any,
      header: {
        entityLegalName,
        reportName: `Notes to the Financial Statements – Note ${code}`,
        periodLine: `For the period ${from} to ${to}`,
        currencyIsoCode,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Notes_to_the_Financial_Statements_${code}_${String(
        period.name ?? dto.periodId,
      )
        .trim()
        .replace(/\s+/g, '_')}.pdf"`,
    );
    res.send(body);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.REPORT.DISCLOSURE_VIEW)
  async get(@Req() req: Request, @Param('id') id: string) {
    const note = await this.disclosureNotes.getNote(req, id);

    await this.audit
      .disclosureNoteView({
        req,
        noteId: note.id,
        permissionUsed: PERMISSIONS.REPORT.DISCLOSURE_VIEW,
        outcome: 'SUCCESS',
      })
      .catch(() => undefined);

    return note;
  }
}
