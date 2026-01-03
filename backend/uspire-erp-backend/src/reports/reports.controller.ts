import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { TimeoutInterceptor } from '../internal/timeout.interceptor';
import { TenantRateLimitGuard } from '../internal/tenant-rate-limit.guard';
import { AgingQueryDto } from './dto/aging-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { CashFlowQueryDto } from './dto/cash-flow-query.dto';
import { PnlQueryDto } from './dto/pnl-query.dto';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { ReportCompareQueryDto } from './dto/report-compare-query.dto';
import { ReportExportQueryDto } from './dto/report-export-query.dto';
import { SoceQueryDto } from './dto/soce-query.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { VatSummaryQueryDto } from './dto/vat-summary-query.dto';
import { FinancialStatementsService } from './financial-statements.service';
import { ReportAuditService } from './report-audit.service';
import { ReportExportService } from './report-export.service';
import { ReportPresentationService } from './report-presentation.service';
import { buildDeterministicReportEntityId } from './report-id.util';
import { assertNoUnsupportedDimensions } from './report-query.validator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseGuards(new TenantRateLimitGuard(10_000, 30, 'reports'))
@UseInterceptors(new TimeoutInterceptor(15_000, 'Reports'))
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly financial: FinancialStatementsService,
    private readonly presentation: ReportPresentationService,
    private readonly exports: ReportExportService,
    private readonly audit: ReportAuditService,
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

  @Get('pl')
  @Permissions('report.view.pl')
  async plPresentation(
    @Req() req: Request,
    @Query() dto: PnlQueryDto & ReportCompareQueryDto,
  ) {
    assertNoUnsupportedDimensions(req.query as any, ['from', 'to', 'compare']);

    const presented = await this.presentation.presentPL(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare,
    });

    const entity = buildDeterministicReportEntityId({
      reportType: 'PL',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    const outcome = presented.compareOmittedReason ? 'BLOCKED' : 'SUCCESS';
    await this.audit
      .reportView({
        req,
        entityId: entity.entityId,
        permissionUsed: 'report.view.pl',
        outcome,
        reason: presented.compareOmittedReason,
      })
      .catch(() => undefined);

    return { entityId: entity.entityId, report: presented };
  }

  @Get('bs')
  @Permissions('report.view.bs')
  async bsPresentation(
    @Req() req: Request,
    @Query() dto: BalanceSheetQueryDto & ReportCompareQueryDto,
  ) {
    assertNoUnsupportedDimensions(req.query as any, ['asOf', 'compare']);

    const presented = await this.presentation.presentBS(req, {
      asOf: dto.asOf,
      compare: dto.compare,
    });

    const entity = buildDeterministicReportEntityId({
      reportType: 'BS',
      from: presented.period.asOf,
      to: presented.period.asOf,
      compareFrom: presented.comparePeriod?.asOf,
      compareTo: presented.comparePeriod?.asOf,
      filters: {},
    });

    const outcome = presented.compareOmittedReason ? 'BLOCKED' : 'SUCCESS';
    await this.audit
      .reportView({
        req,
        entityId: entity.entityId,
        permissionUsed: 'report.view.bs',
        outcome,
        reason: presented.compareOmittedReason,
      })
      .catch(() => undefined);

    return { entityId: entity.entityId, report: presented };
  }

  @Get('soce')
  @Permissions('FINANCE_SOE_VIEW', 'FINANCE_REPORT_GENERATE')
  async socePresentation(
    @Req() req: Request,
    @Query() dto: SoceQueryDto & ReportCompareQueryDto,
  ) {
    assertNoUnsupportedDimensions(req.query as any, ['from', 'to', 'compare']);

    const presented = await this.presentation.presentSOCE(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare === 'prior_year' ? 'prior_year' : undefined,
    });

    const entity = buildDeterministicReportEntityId({
      reportType: 'SOCE',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    const outcome = presented.compareOmittedReason ? 'BLOCKED' : 'SUCCESS';
    await this.audit
      .reportView({
        req,
        entityId: entity.entityId,
        permissionUsed: 'FINANCE_REPORT_GENERATE',
        outcome,
        reason: presented.compareOmittedReason,
      })
      .catch(() => undefined);

    return { entityId: entity.entityId, report: presented };
  }

  @Get('cf')
  @Permissions('FINANCE_CASHFLOW_VIEW', 'FINANCE_REPORT_GENERATE')
  async cfPresentation(
    @Req() req: Request,
    @Query() dto: CashFlowQueryDto & ReportCompareQueryDto,
  ) {
    assertNoUnsupportedDimensions(req.query as any, ['from', 'to', 'compare']);

    const presented = await this.presentation.presentCF(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare,
    });

    const entity = buildDeterministicReportEntityId({
      reportType: 'CF',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    const outcome = presented.compareOmittedReason ? 'BLOCKED' : 'SUCCESS';
    await this.audit
      .reportView({
        req,
        entityId: entity.entityId,
        permissionUsed: 'FINANCE_REPORT_GENERATE',
        outcome,
        reason: presented.compareOmittedReason,
      })
      .catch(() => undefined);

    return { entityId: entity.entityId, report: presented };
  }

  @Get('pl/export')
  @Permissions('FINANCE_REPORT_EXPORT', 'report.view.pl')
  async exportPl(
    @Req() req: Request,
    @Query() dto: PnlQueryDto & ReportExportQueryDto,
    @Res() res: Response,
  ) {
    assertNoUnsupportedDimensions(req.query as any, [
      'from',
      'to',
      'compare',
      'format',
    ]);

    const presented = await this.presentation.presentPL(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare,
    });
    const entity = buildDeterministicReportEntityId({
      reportType: 'PL',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    if (dto.format === 'csv') {
      const body = this.exports.toCsv(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'CSV',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.csv"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'xlsx') {
      const body = await this.exports.toXlsx(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'XLSX',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.xlsx"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'pdf') {
      const { entityLegalName, currencyIsoCode } =
        this.getTenantPdfMetaOrThrow(req);
      const body = await this.exports.toPdf({
        report: presented,
        header: {
          entityLegalName,
          reportName: 'Statement of Profit or Loss',
          periodLine: `For the period ${presented.period.from} to ${presented.period.to}`,
          currencyIsoCode,
          headerFooterLine: `Currency: ${currencyIsoCode}`,
        },
      });
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'PDF',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.pdf"`,
      );
      res.send(body);
      return;
    }

    throw new BadRequestException('Export format not available');
  }

  @Get('bs/export')
  @Permissions('FINANCE_REPORT_EXPORT', 'report.view.bs')
  async exportBs(
    @Req() req: Request,
    @Query() dto: BalanceSheetQueryDto & ReportExportQueryDto,
    @Res() res: Response,
  ) {
    assertNoUnsupportedDimensions(req.query as any, [
      'asOf',
      'compare',
      'format',
    ]);

    const presented = await this.presentation.presentBS(req, {
      asOf: dto.asOf,
      compare: dto.compare,
    });
    const entity = buildDeterministicReportEntityId({
      reportType: 'BS',
      from: presented.period.asOf,
      to: presented.period.asOf,
      compareFrom: presented.comparePeriod?.asOf,
      compareTo: presented.comparePeriod?.asOf,
      filters: {},
    });

    if (dto.format === 'csv') {
      const body = this.exports.toCsv(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'CSV',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.csv"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'xlsx') {
      const body = await this.exports.toXlsx(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'XLSX',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.xlsx"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'pdf') {
      const { entityLegalName, currencyIsoCode } =
        this.getTenantPdfMetaOrThrow(req);
      const body = await this.exports.toPdf({
        report: presented,
        header: {
          entityLegalName,
          reportName: 'Statement of Financial Position',
          periodLine: `As at ${presented.period.asOf}`,
          currencyIsoCode,
        },
      });
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'PDF',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.pdf"`,
      );
      res.send(body);
      return;
    }

    throw new BadRequestException('Export format not available');
  }

  @Get('soce/export')
  @Permissions(
    'FINANCE_REPORT_EXPORT',
    'FINANCE_REPORT_GENERATE',
    'FINANCE_SOE_VIEW',
  )
  async exportSoce(
    @Req() req: Request,
    @Query() dto: SoceQueryDto & ReportExportQueryDto,
    @Res() res: Response,
  ) {
    assertNoUnsupportedDimensions(req.query as any, [
      'from',
      'to',
      'compare',
      'format',
    ]);

    const presented = await this.presentation.presentSOCE(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare === 'prior_year' ? 'prior_year' : undefined,
    });
    const entity = buildDeterministicReportEntityId({
      reportType: 'SOCE',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    if (dto.format === 'csv') {
      const body = this.exports.toCsv(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'CSV',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.csv"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'xlsx') {
      const body = await this.exports.toXlsx(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'XLSX',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.xlsx"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'pdf') {
      const { entityLegalName, currencyIsoCode } =
        this.getTenantPdfMetaOrThrow(req);
      const body = await this.exports.toSocePdf({
        soce: await this.financial.computeSOCE(req, {
          from: dto.from,
          to: dto.to,
        }),
        header: {
          entityLegalName,
          reportName: 'Statement of Changes in Equity',
          periodLine: `For the period ${dto.from} to ${dto.to}`,
          currencyIsoCode,
        },
      });
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'PDF',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.pdf"`,
      );
      res.send(body);
      return;
    }

    throw new BadRequestException('Export format not available');
  }

  @Get('cf/export')
  @Permissions(
    'FINANCE_REPORT_EXPORT',
    'FINANCE_REPORT_GENERATE',
    'FINANCE_CASHFLOW_VIEW',
  )
  async exportCf(
    @Req() req: Request,
    @Query() dto: CashFlowQueryDto & ReportExportQueryDto,
    @Res() res: Response,
  ) {
    assertNoUnsupportedDimensions(req.query as any, [
      'from',
      'to',
      'compare',
      'format',
    ]);

    const presented = await this.presentation.presentCF(req, {
      from: dto.from,
      to: dto.to,
      compare: dto.compare,
    });
    const entity = buildDeterministicReportEntityId({
      reportType: 'CF',
      from: presented.period.from,
      to: presented.period.to,
      compareFrom: presented.comparePeriod?.from,
      compareTo: presented.comparePeriod?.to,
      filters: {},
    });

    if (dto.format === 'csv') {
      const body = this.exports.toCsv(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'CSV',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.csv"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'xlsx') {
      const body = await this.exports.toXlsx(presented);
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'XLSX',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.xlsx"`,
      );
      res.send(body);
      return;
    }

    if (dto.format === 'pdf') {
      const { entityLegalName, currencyIsoCode } =
        this.getTenantPdfMetaOrThrow(req);
      const body = await this.exports.toPdf({
        report: presented,
        header: {
          entityLegalName,
          reportName: 'Statement of Cash Flows',
          periodLine: `For the period ${presented.period.from} to ${presented.period.to}`,
          currencyIsoCode,
        },
      });
      await this.audit
        .reportExport({
          req,
          entityId: entity.entityId,
          permissionUsed: 'FINANCE_REPORT_EXPORT',
          format: 'PDF',
          outcome: 'SUCCESS',
        })
        .catch(() => undefined);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.pdf"`,
      );
      res.send(body);
      return;
    }

    throw new BadRequestException('Export format not available');
  }

  @Get('profit-loss-legacy')
  @Permissions('FINANCE_PL_VIEW')
  async profitLossLegacy(
    @Req() req: Request,
    @Query() dto: ProfitLossQueryDto,
  ) {
    return this.reports.profitLoss(req, dto);
  }

  @Get('pnl')
  @Permissions('FINANCE_PNL_VIEW')
  async pnl(@Req() req: Request, @Query() dto: PnlQueryDto) {
    return this.financial.computeProfitAndLoss(req, dto);
  }

  @Get('balance-sheet-legacy')
  @Permissions('FINANCE_BS_VIEW')
  async balanceSheetLegacy(
    @Req() req: Request,
    @Query() dto: BalanceSheetQueryDto,
  ) {
    return this.reports.balanceSheet(req, dto);
  }

  @Get('balance-sheet')
  @Permissions('FINANCE_BALANCE_SHEET_VIEW')
  async balanceSheet(@Req() req: Request, @Query() dto: BalanceSheetQueryDto) {
    return this.financial.computeBalanceSheet(req, dto);
  }

  @Get('soce-engine')
  @Permissions('FINANCE_SOE_VIEW')
  async soce(@Req() req: Request, @Query() dto: SoceQueryDto) {
    return this.financial.computeSOCE(req, dto);
  }

  @Get('cash-flow')
  @Permissions('FINANCE_CASHFLOW_VIEW')
  async cashFlow(@Req() req: Request, @Query() dto: CashFlowQueryDto) {
    return this.financial.computeCashFlowIndirect(req, dto);
  }

  @Get('ap-aging')
  @Permissions('FINANCE_AP_AGING_VIEW')
  async apAging(@Req() req: Request, @Query() dto: AgingQueryDto) {
    return this.reports.apAging(req, dto);
  }

  @Get('ar-aging')
  @Permissions('FINANCE_AR_AGING_VIEW')
  async arAging(@Req() req: Request, @Query() dto: AgingQueryDto) {
    return this.reports.arAging(req, dto);
  }

  @Get('supplier-statement/:supplierId')
  @Permissions('FINANCE_SUPPLIER_STATEMENT_VIEW')
  async supplierStatement(
    @Req() req: Request,
    @Param('supplierId') supplierId: string,
    @Query() dto: StatementQueryDto,
  ) {
    return this.reports.supplierStatement(req, supplierId, dto);
  }

  @Get('customer-statement/:customerId')
  @Permissions('FINANCE_CUSTOMER_STATEMENT_VIEW')
  async customerStatement(
    @Req() req: Request,
    @Param('customerId') customerId: string,
    @Query() dto: StatementQueryDto,
  ) {
    return this.reports.customerStatement(req, customerId, dto);
  }

  @Get('vat-summary')
  @Permissions('TAX_REPORT_VIEW')
  async vatSummary(@Req() req: Request, @Query() dto: VatSummaryQueryDto) {
    return this.reports.vatSummary(req, dto);
  }
}
