"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const timeout_interceptor_1 = require("../internal/timeout.interceptor");
const tenant_rate_limit_guard_1 = require("../internal/tenant-rate-limit.guard");
const aging_query_dto_1 = require("./dto/aging-query.dto");
const balance_sheet_query_dto_1 = require("./dto/balance-sheet-query.dto");
const cash_flow_query_dto_1 = require("./dto/cash-flow-query.dto");
const pnl_query_dto_1 = require("./dto/pnl-query.dto");
const profit_loss_query_dto_1 = require("./dto/profit-loss-query.dto");
const soce_query_dto_1 = require("./dto/soce-query.dto");
const statement_query_dto_1 = require("./dto/statement-query.dto");
const vat_summary_query_dto_1 = require("./dto/vat-summary-query.dto");
const financial_statements_service_1 = require("./financial-statements.service");
const report_audit_service_1 = require("./report-audit.service");
const report_export_service_1 = require("./report-export.service");
const report_presentation_service_1 = require("./report-presentation.service");
const report_id_util_1 = require("./report-id.util");
const report_query_validator_1 = require("./report-query.validator");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    reports;
    financial;
    presentation;
    exports;
    audit;
    constructor(reports, financial, presentation, exports, audit) {
        this.reports = reports;
        this.financial = financial;
        this.presentation = presentation;
        this.exports = exports;
        this.audit = audit;
    }
    getTenantPdfMetaOrThrow(req) {
        const tenant = req.tenant;
        const entityLegalName = String(tenant?.legalName ?? '').trim();
        if (!entityLegalName) {
            throw new common_1.BadRequestException('Missing Entity Legal Name in Tenant settings. Configure Settings → Tenant → Legal Name before exporting.');
        }
        const currencyIsoCode = String(tenant?.defaultCurrency ?? '').trim();
        if (!currencyIsoCode) {
            throw new common_1.BadRequestException('Missing default currency in Tenant settings. Configure Settings → Tenant → Default Currency before exporting.');
        }
        return { entityLegalName, currencyIsoCode };
    }
    async plPresentation(req, dto) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, ['from', 'to', 'compare']);
        const presented = await this.presentation.presentPL(req, {
            from: dto.from,
            to: dto.to,
            compare: dto.compare,
        });
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
    async bsPresentation(req, dto) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, ['asOf', 'compare']);
        const presented = await this.presentation.presentBS(req, {
            asOf: dto.asOf,
            compare: dto.compare,
        });
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
    async socePresentation(req, dto) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, ['from', 'to', 'compare']);
        const presented = await this.presentation.presentSOCE(req, {
            from: dto.from,
            to: dto.to,
            compare: dto.compare === 'prior_year' ? 'prior_year' : undefined,
        });
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
    async cfPresentation(req, dto) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, ['from', 'to', 'compare']);
        const presented = await this.presentation.presentCF(req, {
            from: dto.from,
            to: dto.to,
            compare: dto.compare,
        });
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
    async exportPl(req, dto, res) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, [
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
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.csv"`);
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
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.xlsx"`);
            res.send(body);
            return;
        }
        if (dto.format === 'pdf') {
            const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Profit_or_Loss_${dto.from}_to_${dto.to}.pdf"`);
            res.send(body);
            return;
        }
        throw new common_1.BadRequestException('Export format not available');
    }
    async exportBs(req, dto, res) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, [
            'asOf',
            'compare',
            'format',
        ]);
        const presented = await this.presentation.presentBS(req, {
            asOf: dto.asOf,
            compare: dto.compare,
        });
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.csv"`);
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
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.xlsx"`);
            res.send(body);
            return;
        }
        if (dto.format === 'pdf') {
            const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Financial_Position_As_At_${dto.asOf}.pdf"`);
            res.send(body);
            return;
        }
        throw new common_1.BadRequestException('Export format not available');
    }
    async exportSoce(req, dto, res) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, [
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
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.csv"`);
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
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.xlsx"`);
            res.send(body);
            return;
        }
        if (dto.format === 'pdf') {
            const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Changes_in_Equity_${dto.from}_to_${dto.to}.pdf"`);
            res.send(body);
            return;
        }
        throw new common_1.BadRequestException('Export format not available');
    }
    async exportCf(req, dto, res) {
        (0, report_query_validator_1.assertNoUnsupportedDimensions)(req.query, [
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
        const entity = (0, report_id_util_1.buildDeterministicReportEntityId)({
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.csv"`);
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
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.xlsx"`);
            res.send(body);
            return;
        }
        if (dto.format === 'pdf') {
            const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
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
            res.setHeader('Content-Disposition', `attachment; filename="Statement_of_Cash_Flows_${dto.from}_to_${dto.to}.pdf"`);
            res.send(body);
            return;
        }
        throw new common_1.BadRequestException('Export format not available');
    }
    async profitLossLegacy(req, dto) {
        return this.reports.profitLoss(req, dto);
    }
    async pnl(req, dto) {
        return this.financial.computeProfitAndLoss(req, dto);
    }
    async balanceSheetLegacy(req, dto) {
        return this.reports.balanceSheet(req, dto);
    }
    async balanceSheet(req, dto) {
        return this.financial.computeBalanceSheet(req, dto);
    }
    async soce(req, dto) {
        return this.financial.computeSOCE(req, dto);
    }
    async cashFlow(req, dto) {
        return this.financial.computeCashFlowIndirect(req, dto);
    }
    async apAging(req, dto) {
        return this.reports.apAging(req, dto);
    }
    async arAging(req, dto) {
        return this.reports.arAging(req, dto);
    }
    async supplierStatement(req, supplierId, dto) {
        return this.reports.supplierStatement(req, supplierId, dto);
    }
    async customerStatement(req, customerId, dto) {
        return this.reports.customerStatement(req, customerId, dto);
    }
    async vatSummary(req, dto) {
        return this.reports.vatSummary(req, dto);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('pl'),
    (0, permissions_decorator_1.Permissions)('report.view.pl'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "plPresentation", null);
__decorate([
    (0, common_1.Get)('bs'),
    (0, permissions_decorator_1.Permissions)('report.view.bs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "bsPresentation", null);
__decorate([
    (0, common_1.Get)('soce'),
    (0, permissions_decorator_1.Permissions)('FINANCE_SOE_VIEW', 'FINANCE_REPORT_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "socePresentation", null);
__decorate([
    (0, common_1.Get)('cf'),
    (0, permissions_decorator_1.Permissions)('FINANCE_CASHFLOW_VIEW', 'FINANCE_REPORT_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "cfPresentation", null);
__decorate([
    (0, common_1.Get)('pl/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'report.view.pl'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportPl", null);
__decorate([
    (0, common_1.Get)('bs/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'report.view.bs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportBs", null);
__decorate([
    (0, common_1.Get)('soce/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'FINANCE_REPORT_GENERATE', 'FINANCE_SOE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportSoce", null);
__decorate([
    (0, common_1.Get)('cf/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'FINANCE_REPORT_GENERATE', 'FINANCE_CASHFLOW_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportCf", null);
__decorate([
    (0, common_1.Get)('profit-loss-legacy'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, profit_loss_query_dto_1.ProfitLossQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "profitLossLegacy", null);
__decorate([
    (0, common_1.Get)('pnl'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PNL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pnl_query_dto_1.PnlQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "pnl", null);
__decorate([
    (0, common_1.Get)('balance-sheet-legacy'),
    (0, permissions_decorator_1.Permissions)('FINANCE_BS_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, balance_sheet_query_dto_1.BalanceSheetQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "balanceSheetLegacy", null);
__decorate([
    (0, common_1.Get)('balance-sheet'),
    (0, permissions_decorator_1.Permissions)('FINANCE_BALANCE_SHEET_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, balance_sheet_query_dto_1.BalanceSheetQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "balanceSheet", null);
__decorate([
    (0, common_1.Get)('soce-engine'),
    (0, permissions_decorator_1.Permissions)('FINANCE_SOE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, soce_query_dto_1.SoceQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "soce", null);
__decorate([
    (0, common_1.Get)('cash-flow'),
    (0, permissions_decorator_1.Permissions)('FINANCE_CASHFLOW_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cash_flow_query_dto_1.CashFlowQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "cashFlow", null);
__decorate([
    (0, common_1.Get)('ap-aging'),
    (0, permissions_decorator_1.Permissions)('FINANCE_AP_AGING_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, aging_query_dto_1.AgingQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "apAging", null);
__decorate([
    (0, common_1.Get)('ar-aging'),
    (0, permissions_decorator_1.Permissions)('FINANCE_AR_AGING_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, aging_query_dto_1.AgingQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "arAging", null);
__decorate([
    (0, common_1.Get)('supplier-statement/:supplierId'),
    (0, permissions_decorator_1.Permissions)('FINANCE_SUPPLIER_STATEMENT_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('supplierId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, statement_query_dto_1.StatementQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "supplierStatement", null);
__decorate([
    (0, common_1.Get)('customer-statement/:customerId'),
    (0, permissions_decorator_1.Permissions)('FINANCE_CUSTOMER_STATEMENT_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('customerId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, statement_query_dto_1.StatementQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "customerStatement", null);
__decorate([
    (0, common_1.Get)('vat-summary'),
    (0, permissions_decorator_1.Permissions)('TAX_REPORT_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vat_summary_query_dto_1.VatSummaryQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "vatSummary", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.UseGuards)(new tenant_rate_limit_guard_1.TenantRateLimitGuard(10_000, 30, 'reports')),
    (0, common_1.UseInterceptors)(new timeout_interceptor_1.TimeoutInterceptor(15_000, 'Reports')),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        financial_statements_service_1.FinancialStatementsService,
        report_presentation_service_1.ReportPresentationService,
        report_export_service_1.ReportExportService,
        report_audit_service_1.ReportAuditService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map