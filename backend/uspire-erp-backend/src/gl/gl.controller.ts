import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions, PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateRecurringTemplateDto } from './dto/create-recurring-template.dto';
import { GenerateRecurringTemplateDto } from './dto/generate-recurring-template.dto';
import { OpeningBalancesQueryDto } from './dto/opening-balances-query.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { ReturnToReviewDto } from './dto/return-to-review.dto';
import { ReverseJournalDto } from './dto/reverse-journal.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { UpdateRecurringTemplateDto } from './dto/update-recurring-template.dto';
import { UpsertOpeningBalancesJournalDto } from './dto/upsert-opening-balances-journal.dto';
import { ReportExportQueryDto } from '../reports/dto/report-export-query.dto';
import { ReportExportService } from '../reports/report-export.service';
import { GlService } from './gl.service';
import { ReviewPackService } from './review-pack.service';

@Controller('gl')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GlController {
  constructor(
    private readonly gl: GlService,
    private readonly reviewPacks: ReviewPackService,
    private readonly exports: ReportExportService,
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

  @Post('accounts')
  @Permissions('FINANCE_GL_CREATE')
  async createAccount(@Req() req: Request, @Body() dto: CreateAccountDto) {
    return this.gl.createAccount(req, dto);
  }

  @Get('accounts')
  @Permissions('FINANCE_GL_VIEW')
  async listAccounts(
    @Req() req: Request,
    @Query('balanceSheetOnly') balanceSheetOnly?: string,
  ) {
    return this.gl.listAccounts(req, {
      balanceSheetOnly: balanceSheetOnly === 'true',
    });
  }

  @Get('legal-entities')
  @Permissions('FINANCE_GL_VIEW')
  async listLegalEntities(
    @Req() req: Request,
    @Query('effectiveOn') effectiveOn?: string,
  ) {
    return this.gl.listLegalEntities(req, { effectiveOn });
  }

  @Get('departments')
  @Permissions('FINANCE_GL_VIEW')
  async listDepartments(
    @Req() req: Request,
    @Query('effectiveOn') effectiveOn?: string,
  ) {
    return this.gl.listDepartments(req, { effectiveOn });
  }

  @Get('projects')
  @Permissions('FINANCE_GL_VIEW')
  async listProjects(
    @Req() req: Request,
    @Query('effectiveOn') effectiveOn?: string,
  ) {
    return this.gl.listProjects(req, { effectiveOn });
  }

  @Get('funds')
  @Permissions('FINANCE_GL_VIEW')
  async listFunds(
    @Req() req: Request,
    @Query('effectiveOn') effectiveOn?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.gl.listFunds(req, { effectiveOn, projectId });
  }

  @Post('journals')
  @Permissions('FINANCE_GL_CREATE')
  async createJournal(@Req() req: Request, @Body() dto: CreateJournalDto) {
    return this.gl.createDraftJournal(req, dto);
  }

  @Post('journals/upload')
  @Permissions('FINANCE_GL_CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadJournals(@Req() req: Request, @UploadedFile() file: any) {
    return this.gl.uploadJournals(req, file);
  }

  @Get('journals/upload/template.csv')
  @Permissions('FINANCE_GL_CREATE')
  async downloadJournalUploadCsvTemplate(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.gl.getJournalUploadCsvTemplate(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  @Get('journals/upload/template.xlsx')
  @Permissions('FINANCE_GL_CREATE')
  async downloadJournalUploadXlsxTemplate(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const out = await this.gl.getJournalUploadXlsxTemplate(req);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  @Get('journals/review-queue')
  @Permissions('FINANCE_GL_APPROVE')
  async listReviewQueue(@Req() req: Request) {
    return this.gl.listJournalReviewQueue(req);
  }

  @Get('journals/post-queue')
  @Permissions('FINANCE_GL_FINAL_POST')
  async listPostQueue(@Req() req: Request) {
    return this.gl.listJournalPostQueue(req);
  }

  @Post('recurring-templates')
  @Permissions('FINANCE_GL_RECURRING_MANAGE')
  async createRecurringTemplate(
    @Req() req: Request,
    @Body() dto: CreateRecurringTemplateDto,
  ) {
    return this.gl.createRecurringTemplate(req, dto);
  }

  @Get('recurring-templates')
  @PermissionsAny(
    'FINANCE_GL_RECURRING_MANAGE',
    'FINANCE_GL_RECURRING_GENERATE',
  )
  async listRecurringTemplates(@Req() req: Request) {
    return this.gl.listRecurringTemplates(req);
  }

  @Put('recurring-templates/:id')
  @Permissions('FINANCE_GL_RECURRING_MANAGE')
  async updateRecurringTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTemplateDto,
  ) {
    return this.gl.updateRecurringTemplate(req, id, dto);
  }

  @Post('recurring-templates/:id/generate')
  @Permissions('FINANCE_GL_RECURRING_GENERATE')
  async generateRecurringTemplate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: GenerateRecurringTemplateDto,
  ) {
    return this.gl.generateJournalFromRecurringTemplate(req, id, dto);
  }

  @Get('recurring-templates/:id/history')
  @PermissionsAny(
    'FINANCE_GL_RECURRING_MANAGE',
    'FINANCE_GL_RECURRING_GENERATE',
  )
  async getRecurringTemplateHistory(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    return this.gl.getRecurringTemplateHistory(req, id);
  }

  @Get('journals/:id')
  @Permissions('FINANCE_GL_VIEW')
  async getJournal(@Req() req: Request, @Param('id') id: string) {
    return this.gl.getJournal(req, id);
  }

  @Get('journals/:id/detail')
  @Permissions('FINANCE_GL_VIEW')
  async getJournalDetail(@Req() req: Request, @Param('id') id: string) {
    return this.gl.getJournalDetail(req, id);
  }

  @Put('journals/:id')
  @Permissions('FINANCE_GL_CREATE')
  async updateJournal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateJournalDto,
  ) {
    return this.gl.updateDraftJournal(req, id, dto);
  }

  @Post('journals/:id/submit')
  @Permissions('FINANCE_GL_CREATE')
  async submitJournal(@Req() req: Request, @Param('id') id: string) {
    return this.gl.submitJournal(req, id);
  }

  @Post('journals/:id/review')
  @Permissions('FINANCE_GL_APPROVE')
  async reviewJournal(@Req() req: Request, @Param('id') id: string) {
    return this.gl.reviewJournal(req, id);
  }

  @Post('journals/:id/reject')
  @Permissions('FINANCE_GL_APPROVE')
  async rejectJournal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.gl.rejectJournal(req, id, { reason: body?.reason });
  }

  @Post('journals/:id/park')
  @Permissions('FINANCE_GL_CREATE')
  async parkJournal(@Req() req: Request, @Param('id') id: string) {
    return this.gl.parkJournal(req, id);
  }

  @Post('journals/:id/post')
  @Permissions('FINANCE_GL_FINAL_POST')
  async postJournal(@Req() req: Request, @Param('id') id: string) {
    return this.gl.postJournal(req, id);
  }

  @Post('journals/:id/return-to-review')
  @Permissions('FINANCE_GL_FINAL_POST')
  async returnToReview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReturnToReviewDto,
  ) {
    return this.gl.returnJournalToReview(req, id, dto);
  }

  @Post('journals/:id/reverse')
  @Permissions('FINANCE_GL_FINAL_POST')
  async reverseJournal(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReverseJournalDto,
  ) {
    return this.gl.reversePostedJournal(req, id, dto);
  }

  @Get('journals')
  @Permissions('FINANCE_GL_VIEW')
  async listJournals(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('budgetStatus') budgetStatus?: string,
    @Query('drilldown') drilldown?: string,
    @Query('workbench') workbench?: string,
    @Query('periodId') periodId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('accountId') accountId?: string,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('projectId') projectId?: string,
    @Query('fundId') fundId?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('minRiskScore') minRiskScore?: string,
    @Query('maxRiskScore') maxRiskScore?: string,
    @Query('createdById') createdById?: string,
    @Query('reviewedById') reviewedById?: string,
    @Query('postedById') postedById?: string,
  ) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    const parsedOffset = offset === undefined ? undefined : Number(offset);

    const safeLimit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? parsedLimit
        : undefined;
    const safeOffset =
      parsedOffset !== undefined && Number.isFinite(parsedOffset)
        ? parsedOffset
        : undefined;

    const safeStatus =
      status === 'DRAFT' ||
      status === 'SUBMITTED' ||
      status === 'REVIEWED' ||
      status === 'REJECTED' ||
      status === 'PARKED' ||
      status === 'POSTED'
        ? (status as any)
        : undefined;

    const safeBudgetStatus =
      budgetStatus === 'OK' ||
      budgetStatus === 'WARN' ||
      budgetStatus === 'BLOCK'
        ? (budgetStatus as any)
        : undefined;

    const parsedMinRisk =
      minRiskScore === undefined ? undefined : Number(minRiskScore);
    const parsedMaxRisk =
      maxRiskScore === undefined ? undefined : Number(maxRiskScore);

    const safeRiskLevel =
      riskLevel === 'LOW' || riskLevel === 'MEDIUM' || riskLevel === 'HIGH'
        ? (riskLevel as any)
        : undefined;

    const safeMinRiskScore =
      parsedMinRisk !== undefined && Number.isFinite(parsedMinRisk)
        ? parsedMinRisk
        : undefined;
    const safeMaxRiskScore =
      parsedMaxRisk !== undefined && Number.isFinite(parsedMaxRisk)
        ? parsedMaxRisk
        : undefined;

    return this.gl.listJournals(req, {
      limit: safeLimit,
      offset: safeOffset,
      status: safeStatus,
      budgetStatus: safeBudgetStatus,
      drilldown:
        drilldown === '1' || (drilldown ?? '').toLowerCase() === 'true',
      workbench:
        workbench === '1' || (workbench ?? '').toLowerCase() === 'true',
      periodId,
      fromDate,
      toDate,
      accountId,
      legalEntityId,
      departmentId,
      projectId,
      fundId,
      riskLevel: safeRiskLevel,
      minRiskScore: safeMinRiskScore,
      maxRiskScore: safeMaxRiskScore,
      createdById,
      reviewedById,
      postedById,
    });
  }

  @Post('periods')
  @Permissions('FINANCE_PERIOD_CREATE')
  async createPeriod(
    @Req() req: Request,
    @Body() dto: CreateAccountingPeriodDto,
  ) {
    return this.gl.createAccountingPeriod(req, dto);
  }

  @Get('periods/:id/checklist')
  @PermissionsAny('FINANCE_PERIOD_VIEW', 'FINANCE_PERIOD_REVIEW')
  async getPeriodChecklist(@Req() req: Request, @Param('id') id: string) {
    return this.gl.getAccountingPeriodChecklist(req, id);
  }

  @Post('periods/:id/checklist/items/:itemId/complete')
  @Permissions('FINANCE_PERIOD_CHECKLIST_COMPLETE')
  async completePeriodChecklistItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.gl.completeAccountingPeriodChecklistItem(req, {
      periodId: id,
      itemId,
    });
  }

  @Post('periods/:id/close')
  @Permissions('FINANCE_PERIOD_CLOSE_APPROVE')
  async closePeriod(@Req() req: Request, @Param('id') id: string) {
    return this.gl.closeAccountingPeriod(req, id);
  }

  @Post('periods/:id/reopen')
  @Permissions('FINANCE_PERIOD_REOPEN')
  async reopenPeriod(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
  ) {
    return this.gl.reopenAccountingPeriod(req, id, dto);
  }

  @Get('periods/:id/summary')
  @PermissionsAny('FINANCE_PERIOD_VIEW', 'FINANCE_PERIOD_REVIEW')
  async getPeriodSummary(@Req() req: Request, @Param('id') id: string) {
    return this.gl.getAccountingPeriodSummary(req, id);
  }

  @Post('periods/:id/review-packs')
  @Permissions('AUDIT_REVIEW_PACK_GENERATE')
  async generateReviewPack(@Req() req: Request, @Param('id') id: string) {
    return this.reviewPacks.generateReviewPack(req, id);
  }

  @Get('periods/:id/review-packs')
  @Permissions('AUDIT_REVIEW_PACK_VIEW')
  async listReviewPacks(@Req() req: Request, @Param('id') id: string) {
    return this.reviewPacks.listReviewPacks(req, id);
  }

  @Get('periods/:id/review-packs/:packId/download')
  @Permissions('AUDIT_REVIEW_PACK_VIEW')
  async downloadReviewPack(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('packId') packId: string,
    @Res() res: Response,
  ) {
    const out = await this.reviewPacks.downloadReviewPack(req, id, packId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(out.size ?? out.body.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  @Get('periods')
  @Permissions('FINANCE_GL_VIEW')
  async listPeriods(@Req() req: Request) {
    return this.gl.listAccountingPeriods(req);
  }

  @Get('trial-balance')
  @Permissions('FINANCE_TB_VIEW')
  async trialBalance(@Req() req: Request, @Query() dto: TrialBalanceQueryDto) {
    return this.gl.trialBalance(req, dto);
  }

  @Get('trial-balance/export')
  @Permissions('FINANCE_REPORT_EXPORT', 'FINANCE_TB_VIEW')
  async exportTrialBalance(
    @Req() req: Request,
    @Query() dto: TrialBalanceQueryDto & ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const tb = await this.gl.trialBalance(req, dto);

    if (dto.format === 'xlsx') {
      const body = await this.exports.trialBalanceToXlsx({
        title: 'Trial Balance',
        from: tb.from,
        to: tb.to,
        rows: tb.rows,
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Trial_Balance_${tb.from}_to_${tb.to}.xlsx"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'pdf') {
      const { entityLegalName, currencyIsoCode } =
        this.getTenantPdfMetaOrThrow(req);
      const body = await this.exports.trialBalanceToPdf({
        title: 'Trial Balance',
        header: {
          entityLegalName,
          reportName: 'Trial Balance',
          periodLine: `For the period ${tb.from} to ${tb.to}`,
          currencyIsoCode,
        },
        from: tb.from,
        to: tb.to,
        rows: tb.rows,
        totals: tb.totals,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Trial_Balance_${tb.from}_to_${tb.to}.pdf"`,
      );
      res.send(body);
      return;
    }

    throw new BadRequestException('Export format not available');
  }

  @Get('ledger')
  @Permissions('FINANCE_GL_VIEW')
  async ledger(@Req() req: Request, @Query() dto: LedgerQueryDto) {
    return this.gl.ledger(req, dto);
  }

  @Get('opening-balances')
  @Permissions('FINANCE_GL_VIEW')
  async getOpeningBalances(
    @Req() req: Request,
    @Query() dto: OpeningBalancesQueryDto,
  ) {
    return this.gl.getOpeningBalances(req, dto);
  }

  @Post('opening-balances')
  @Permissions('FINANCE_GL_CREATE')
  async upsertOpeningBalances(
    @Req() req: Request,
    @Body() dto: UpsertOpeningBalancesJournalDto,
  ) {
    return this.gl.upsertOpeningBalances(req, dto);
  }

  @Post('opening-balances/post')
  @Permissions('FINANCE_GL_FINAL_POST')
  async postOpeningBalances(
    @Req() req: Request,
    @Body() dto: OpeningBalancesQueryDto,
  ) {
    return this.gl.postOpeningBalances(req, dto);
  }
}
