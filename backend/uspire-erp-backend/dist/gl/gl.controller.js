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
exports.GlController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const create_account_dto_1 = require("./dto/create-account.dto");
const create_accounting_period_dto_1 = require("./dto/create-accounting-period.dto");
const create_journal_dto_1 = require("./dto/create-journal.dto");
const create_recurring_template_dto_1 = require("./dto/create-recurring-template.dto");
const generate_recurring_template_dto_1 = require("./dto/generate-recurring-template.dto");
const opening_balances_query_dto_1 = require("./dto/opening-balances-query.dto");
const reopen_period_dto_1 = require("./dto/reopen-period.dto");
const return_to_review_dto_1 = require("./dto/return-to-review.dto");
const reverse_journal_dto_1 = require("./dto/reverse-journal.dto");
const ledger_query_dto_1 = require("./dto/ledger-query.dto");
const trial_balance_query_dto_1 = require("./dto/trial-balance-query.dto");
const update_journal_dto_1 = require("./dto/update-journal.dto");
const update_recurring_template_dto_1 = require("./dto/update-recurring-template.dto");
const upsert_opening_balances_journal_dto_1 = require("./dto/upsert-opening-balances-journal.dto");
const report_export_service_1 = require("../reports/report-export.service");
const gl_service_1 = require("./gl.service");
const review_pack_service_1 = require("./review-pack.service");
let GlController = class GlController {
    gl;
    reviewPacks;
    exports;
    constructor(gl, reviewPacks, exports) {
        this.gl = gl;
        this.reviewPacks = reviewPacks;
        this.exports = exports;
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
    async createAccount(req, dto) {
        return this.gl.createAccount(req, dto);
    }
    async listAccounts(req, balanceSheetOnly) {
        return this.gl.listAccounts(req, {
            balanceSheetOnly: balanceSheetOnly === 'true',
        });
    }
    async listLegalEntities(req, effectiveOn) {
        return this.gl.listLegalEntities(req, { effectiveOn });
    }
    async listDepartments(req, effectiveOn) {
        return this.gl.listDepartments(req, { effectiveOn });
    }
    async listProjects(req, effectiveOn) {
        return this.gl.listProjects(req, { effectiveOn });
    }
    async listFunds(req, effectiveOn, projectId) {
        return this.gl.listFunds(req, { effectiveOn, projectId });
    }
    async createJournal(req, dto) {
        return this.gl.createDraftJournal(req, dto);
    }
    async uploadJournals(req, file) {
        return this.gl.uploadJournals(req, file);
    }
    async downloadJournalUploadCsvTemplate(req, res) {
        const out = await this.gl.getJournalUploadCsvTemplate(req);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async downloadJournalUploadXlsxTemplate(req, res) {
        const out = await this.gl.getJournalUploadXlsxTemplate(req);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async listReviewQueue(req) {
        return this.gl.listJournalReviewQueue(req);
    }
    async listPostQueue(req) {
        return this.gl.listJournalPostQueue(req);
    }
    async createRecurringTemplate(req, dto) {
        return this.gl.createRecurringTemplate(req, dto);
    }
    async listRecurringTemplates(req) {
        return this.gl.listRecurringTemplates(req);
    }
    async updateRecurringTemplate(req, id, dto) {
        return this.gl.updateRecurringTemplate(req, id, dto);
    }
    async generateRecurringTemplate(req, id, dto) {
        return this.gl.generateJournalFromRecurringTemplate(req, id, dto);
    }
    async getRecurringTemplateHistory(req, id) {
        return this.gl.getRecurringTemplateHistory(req, id);
    }
    async getJournal(req, id) {
        return this.gl.getJournal(req, id);
    }
    async getJournalDetail(req, id) {
        return this.gl.getJournalDetail(req, id);
    }
    async updateJournal(req, id, dto) {
        return this.gl.updateDraftJournal(req, id, dto);
    }
    async submitJournal(req, id) {
        return this.gl.submitJournal(req, id);
    }
    async reviewJournal(req, id) {
        return this.gl.reviewJournal(req, id);
    }
    async rejectJournal(req, id, body) {
        return this.gl.rejectJournal(req, id, { reason: body?.reason });
    }
    async parkJournal(req, id) {
        return this.gl.parkJournal(req, id);
    }
    async postJournal(req, id) {
        return this.gl.postJournal(req, id);
    }
    async returnToReview(req, id, dto) {
        return this.gl.returnJournalToReview(req, id, dto);
    }
    async reverseJournal(req, id, dto) {
        return this.gl.reversePostedJournal(req, id, dto);
    }
    async listJournals(req, limit, offset, status, budgetStatus, drilldown, workbench, periodId, fromDate, toDate, accountId, legalEntityId, departmentId, projectId, fundId, riskLevel, minRiskScore, maxRiskScore, createdById, reviewedById, postedById) {
        const parsedLimit = limit === undefined ? undefined : Number(limit);
        const parsedOffset = offset === undefined ? undefined : Number(offset);
        const safeLimit = parsedLimit !== undefined && Number.isFinite(parsedLimit)
            ? parsedLimit
            : undefined;
        const safeOffset = parsedOffset !== undefined && Number.isFinite(parsedOffset)
            ? parsedOffset
            : undefined;
        const safeStatus = status === 'DRAFT' ||
            status === 'SUBMITTED' ||
            status === 'REVIEWED' ||
            status === 'REJECTED' ||
            status === 'PARKED' ||
            status === 'POSTED'
            ? status
            : undefined;
        const safeBudgetStatus = budgetStatus === 'OK' ||
            budgetStatus === 'WARN' ||
            budgetStatus === 'BLOCK'
            ? budgetStatus
            : undefined;
        const parsedMinRisk = minRiskScore === undefined ? undefined : Number(minRiskScore);
        const parsedMaxRisk = maxRiskScore === undefined ? undefined : Number(maxRiskScore);
        const safeRiskLevel = riskLevel === 'LOW' || riskLevel === 'MEDIUM' || riskLevel === 'HIGH'
            ? riskLevel
            : undefined;
        const safeMinRiskScore = parsedMinRisk !== undefined && Number.isFinite(parsedMinRisk)
            ? parsedMinRisk
            : undefined;
        const safeMaxRiskScore = parsedMaxRisk !== undefined && Number.isFinite(parsedMaxRisk)
            ? parsedMaxRisk
            : undefined;
        return this.gl.listJournals(req, {
            limit: safeLimit,
            offset: safeOffset,
            status: safeStatus,
            budgetStatus: safeBudgetStatus,
            drilldown: drilldown === '1' || (drilldown ?? '').toLowerCase() === 'true',
            workbench: workbench === '1' || (workbench ?? '').toLowerCase() === 'true',
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
    async createPeriod(req, dto) {
        return this.gl.createAccountingPeriod(req, dto);
    }
    async getPeriodChecklist(req, id) {
        return this.gl.getAccountingPeriodChecklist(req, id);
    }
    async completePeriodChecklistItem(req, id, itemId) {
        return this.gl.completeAccountingPeriodChecklistItem(req, {
            periodId: id,
            itemId,
        });
    }
    async closePeriod(req, id) {
        return this.gl.closeAccountingPeriod(req, id);
    }
    async reopenPeriod(req, id, dto) {
        return this.gl.reopenAccountingPeriod(req, id, dto);
    }
    async getPeriodSummary(req, id) {
        return this.gl.getAccountingPeriodSummary(req, id);
    }
    async generateReviewPack(req, id) {
        return this.reviewPacks.generateReviewPack(req, id);
    }
    async listReviewPacks(req, id) {
        return this.reviewPacks.listReviewPacks(req, id);
    }
    async downloadReviewPack(req, id, packId, res) {
        const out = await this.reviewPacks.downloadReviewPack(req, id, packId);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Length', String(out.size ?? out.body.length));
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async listPeriods(req) {
        return this.gl.listAccountingPeriods(req);
    }
    async trialBalance(req, dto) {
        return this.gl.trialBalance(req, dto);
    }
    async exportTrialBalance(req, dto, res) {
        const tb = await this.gl.trialBalance(req, dto);
        if (dto.format === 'xlsx') {
            const body = await this.exports.trialBalanceToXlsx({
                title: 'Trial Balance',
                from: tb.from,
                to: tb.to,
                rows: tb.rows,
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Trial_Balance_${tb.from}_to_${tb.to}.xlsx"`);
            res.send(body);
            return;
        }
        if (dto.format === 'pdf') {
            const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
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
            res.setHeader('Content-Disposition', `attachment; filename="Trial_Balance_${tb.from}_to_${tb.to}.pdf"`);
            res.send(body);
            return;
        }
        throw new common_1.BadRequestException('Export format not available');
    }
    async ledger(req, dto) {
        return this.gl.ledger(req, dto);
    }
    async getOpeningBalances(req, dto) {
        return this.gl.getOpeningBalances(req, dto);
    }
    async upsertOpeningBalances(req, dto) {
        return this.gl.upsertOpeningBalances(req, dto);
    }
    async postOpeningBalances(req, dto) {
        return this.gl.postOpeningBalances(req, dto);
    }
};
exports.GlController = GlController;
__decorate([
    (0, common_1.Post)('accounts'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_account_dto_1.CreateAccountDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "createAccount", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('balanceSheetOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listAccounts", null);
__decorate([
    (0, common_1.Get)('legal-entities'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('effectiveOn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listLegalEntities", null);
__decorate([
    (0, common_1.Get)('departments'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('effectiveOn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listDepartments", null);
__decorate([
    (0, common_1.Get)('projects'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('effectiveOn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listProjects", null);
__decorate([
    (0, common_1.Get)('funds'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('effectiveOn')),
    __param(2, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listFunds", null);
__decorate([
    (0, common_1.Post)('journals'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_journal_dto_1.CreateJournalDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "createJournal", null);
__decorate([
    (0, common_1.Post)('journals/upload'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "uploadJournals", null);
__decorate([
    (0, common_1.Get)('journals/upload/template.csv'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "downloadJournalUploadCsvTemplate", null);
__decorate([
    (0, common_1.Get)('journals/upload/template.xlsx'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "downloadJournalUploadXlsxTemplate", null);
__decorate([
    (0, common_1.Get)('journals/review-queue'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listReviewQueue", null);
__decorate([
    (0, common_1.Get)('journals/post-queue'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_FINAL_POST'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listPostQueue", null);
__decorate([
    (0, common_1.Post)('recurring-templates'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_RECURRING_MANAGE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_recurring_template_dto_1.CreateRecurringTemplateDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "createRecurringTemplate", null);
__decorate([
    (0, common_1.Get)('recurring-templates'),
    (0, permissions_decorator_1.PermissionsAny)('FINANCE_GL_RECURRING_MANAGE', 'FINANCE_GL_RECURRING_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listRecurringTemplates", null);
__decorate([
    (0, common_1.Put)('recurring-templates/:id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_RECURRING_MANAGE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_recurring_template_dto_1.UpdateRecurringTemplateDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "updateRecurringTemplate", null);
__decorate([
    (0, common_1.Post)('recurring-templates/:id/generate'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_RECURRING_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, generate_recurring_template_dto_1.GenerateRecurringTemplateDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "generateRecurringTemplate", null);
__decorate([
    (0, common_1.Get)('recurring-templates/:id/history'),
    (0, permissions_decorator_1.PermissionsAny)('FINANCE_GL_RECURRING_MANAGE', 'FINANCE_GL_RECURRING_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getRecurringTemplateHistory", null);
__decorate([
    (0, common_1.Get)('journals/:id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getJournal", null);
__decorate([
    (0, common_1.Get)('journals/:id/detail'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getJournalDetail", null);
__decorate([
    (0, common_1.Put)('journals/:id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_journal_dto_1.UpdateJournalDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "updateJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/submit'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "submitJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/review'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "reviewJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/reject'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "rejectJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/park'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "parkJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/post'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_FINAL_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "postJournal", null);
__decorate([
    (0, common_1.Post)('journals/:id/return-to-review'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_FINAL_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, return_to_review_dto_1.ReturnToReviewDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "returnToReview", null);
__decorate([
    (0, common_1.Post)('journals/:id/reverse'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_FINAL_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reverse_journal_dto_1.ReverseJournalDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "reverseJournal", null);
__decorate([
    (0, common_1.Get)('journals'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('budgetStatus')),
    __param(5, (0, common_1.Query)('drilldown')),
    __param(6, (0, common_1.Query)('workbench')),
    __param(7, (0, common_1.Query)('periodId')),
    __param(8, (0, common_1.Query)('fromDate')),
    __param(9, (0, common_1.Query)('toDate')),
    __param(10, (0, common_1.Query)('accountId')),
    __param(11, (0, common_1.Query)('legalEntityId')),
    __param(12, (0, common_1.Query)('departmentId')),
    __param(13, (0, common_1.Query)('projectId')),
    __param(14, (0, common_1.Query)('fundId')),
    __param(15, (0, common_1.Query)('riskLevel')),
    __param(16, (0, common_1.Query)('minRiskScore')),
    __param(17, (0, common_1.Query)('maxRiskScore')),
    __param(18, (0, common_1.Query)('createdById')),
    __param(19, (0, common_1.Query)('reviewedById')),
    __param(20, (0, common_1.Query)('postedById')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listJournals", null);
__decorate([
    (0, common_1.Post)('periods'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PERIOD_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_accounting_period_dto_1.CreateAccountingPeriodDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "createPeriod", null);
__decorate([
    (0, common_1.Get)('periods/:id/checklist'),
    (0, permissions_decorator_1.PermissionsAny)('FINANCE_PERIOD_VIEW', 'FINANCE_PERIOD_REVIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getPeriodChecklist", null);
__decorate([
    (0, common_1.Post)('periods/:id/checklist/items/:itemId/complete'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PERIOD_CHECKLIST_COMPLETE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "completePeriodChecklistItem", null);
__decorate([
    (0, common_1.Post)('periods/:id/close'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PERIOD_CLOSE_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "closePeriod", null);
__decorate([
    (0, common_1.Post)('periods/:id/reopen'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PERIOD_REOPEN'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reopen_period_dto_1.ReopenPeriodDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "reopenPeriod", null);
__decorate([
    (0, common_1.Get)('periods/:id/summary'),
    (0, permissions_decorator_1.PermissionsAny)('FINANCE_PERIOD_VIEW', 'FINANCE_PERIOD_REVIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getPeriodSummary", null);
__decorate([
    (0, common_1.Post)('periods/:id/review-packs'),
    (0, permissions_decorator_1.Permissions)('AUDIT_REVIEW_PACK_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "generateReviewPack", null);
__decorate([
    (0, common_1.Get)('periods/:id/review-packs'),
    (0, permissions_decorator_1.Permissions)('AUDIT_REVIEW_PACK_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listReviewPacks", null);
__decorate([
    (0, common_1.Get)('periods/:id/review-packs/:packId/download'),
    (0, permissions_decorator_1.Permissions)('AUDIT_REVIEW_PACK_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('packId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "downloadReviewPack", null);
__decorate([
    (0, common_1.Get)('periods'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "listPeriods", null);
__decorate([
    (0, common_1.Get)('trial-balance'),
    (0, permissions_decorator_1.Permissions)('FINANCE_TB_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, trial_balance_query_dto_1.TrialBalanceQueryDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "trialBalance", null);
__decorate([
    (0, common_1.Get)('trial-balance/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'FINANCE_TB_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "exportTrialBalance", null);
__decorate([
    (0, common_1.Get)('ledger'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ledger_query_dto_1.LedgerQueryDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "ledger", null);
__decorate([
    (0, common_1.Get)('opening-balances'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, opening_balances_query_dto_1.OpeningBalancesQueryDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "getOpeningBalances", null);
__decorate([
    (0, common_1.Post)('opening-balances'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_opening_balances_journal_dto_1.UpsertOpeningBalancesJournalDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "upsertOpeningBalances", null);
__decorate([
    (0, common_1.Post)('opening-balances/post'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_FINAL_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, opening_balances_query_dto_1.OpeningBalancesQueryDto]),
    __metadata("design:returntype", Promise)
], GlController.prototype, "postOpeningBalances", null);
exports.GlController = GlController = __decorate([
    (0, common_1.Controller)('gl'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [gl_service_1.GlService,
        review_pack_service_1.ReviewPackService,
        report_export_service_1.ReportExportService])
], GlController);
//# sourceMappingURL=gl.controller.js.map