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
exports.DisclosureNotesController = void 0;
const common_1 = require("@nestjs/common");
const timeout_interceptor_1 = require("../internal/timeout.interceptor");
const tenant_rate_limit_guard_1 = require("../internal/tenant-rate-limit.guard");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const disclosure_notes_audit_service_1 = require("./disclosure-notes-audit.service");
const disclosure_notes_service_1 = require("./disclosure-notes.service");
const disclosure_note_generate_dto_1 = require("./dto/disclosure-note-generate.dto");
const disclosure_note_list_dto_1 = require("./dto/disclosure-note-list.dto");
const ifrs_disclosure_notes_service_1 = require("./ifrs-disclosure-notes.service");
const ifrs_disclosure_note_query_dto_1 = require("./dto/ifrs-disclosure-note-query.dto");
const report_export_service_1 = require("./report-export.service");
const prisma_service_1 = require("../prisma/prisma.service");
let DisclosureNotesController = class DisclosureNotesController {
    disclosureNotes;
    ifrsDisclosureNotes;
    exports;
    audit;
    prisma;
    constructor(disclosureNotes, ifrsDisclosureNotes, exports, audit, prisma) {
        this.disclosureNotes = disclosureNotes;
        this.ifrsDisclosureNotes = ifrsDisclosureNotes;
        this.exports = exports;
        this.audit = audit;
        this.prisma = prisma;
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
    async generate(req, dto) {
        try {
            const note = await this.disclosureNotes.generateNote(req, dto.periodId, dto.noteType);
            await this.audit
                .disclosureNoteGenerate({
                req,
                noteId: note.id,
                permissionUsed: 'FINANCE_DISCLOSURE_GENERATE',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    periodId: dto.periodId,
                    noteType: dto.noteType,
                }),
            })
                .catch(() => undefined);
            return note;
        }
        catch (e) {
            const outcome = e instanceof common_1.BadRequestException ? 'BLOCKED' : 'FAILED';
            const msg = e instanceof common_1.HttpException
                ? (e.getResponse()?.message ??
                    e.getResponse()?.error)
                : undefined;
            await this.audit
                .disclosureNoteGenerate({
                req,
                noteId: `period:${dto.periodId}:type:${dto.noteType}`,
                permissionUsed: 'FINANCE_DISCLOSURE_GENERATE',
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
    async list(req, dto) {
        return this.disclosureNotes.listNotes(req, dto.periodId);
    }
    async listIfrs() {
        return this.ifrsDisclosureNotes.listNotes();
    }
    async getIfrs(req, noteCode, dto) {
        const code = String(noteCode ?? '')
            .trim()
            .toUpperCase();
        const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
        if (!allowed.has(code)) {
            throw new common_1.BadRequestException('Invalid IFRS note code. Expected one of: A, B, C, D, E, F, G, H.');
        }
        const note = await this.ifrsDisclosureNotes.generateNote(req, {
            periodId: dto.periodId,
            noteCode: code,
        });
        return note;
    }
    async exportIfrs(req, noteCode, dto, res) {
        const code = String(noteCode ?? '')
            .trim()
            .toUpperCase();
        const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
        if (!allowed.has(code)) {
            throw new common_1.BadRequestException('Invalid IFRS note code. Expected one of: A, B, C, D, E, F, G, H.');
        }
        const note = await this.ifrsDisclosureNotes.generateNote(req, {
            periodId: dto.periodId,
            noteCode: code,
        });
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: dto.periodId, tenantId: tenant.id },
            select: { id: true, name: true, startDate: true, endDate: true },
        });
        if (!period)
            throw new common_1.BadRequestException('Accounting period not found');
        const from = new Date(period.startDate).toISOString().slice(0, 10);
        const to = new Date(period.endDate).toISOString().slice(0, 10);
        const { entityLegalName, currencyIsoCode } = this.getTenantPdfMetaOrThrow(req);
        const body = await this.exports.ifrsDisclosureNoteToPdf({
            note: note,
            header: {
                entityLegalName,
                reportName: `Notes to the Financial Statements – Note ${code}`,
                periodLine: `For the period ${from} to ${to}`,
                currencyIsoCode,
            },
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Notes_to_the_Financial_Statements_${code}_${String(period.name ?? dto.periodId)
            .trim()
            .replace(/\s+/g, '_')}.pdf"`);
        res.send(body);
    }
    async get(req, id) {
        const note = await this.disclosureNotes.getNote(req, id);
        await this.audit
            .disclosureNoteView({
            req,
            noteId: note.id,
            permissionUsed: 'FINANCE_DISCLOSURE_VIEW',
            outcome: 'SUCCESS',
        })
            .catch(() => undefined);
        return note;
    }
};
exports.DisclosureNotesController = DisclosureNotesController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, permissions_decorator_1.Permissions)('FINANCE_DISCLOSURE_GENERATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, disclosure_note_generate_dto_1.DisclosureNoteGenerateDto]),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('FINANCE_DISCLOSURE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, disclosure_note_list_dto_1.DisclosureNoteListQueryDto]),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('ifrs'),
    (0, permissions_decorator_1.Permissions)('FINANCE_DISCLOSURE_VIEW'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "listIfrs", null);
__decorate([
    (0, common_1.Get)('ifrs/:noteCode'),
    (0, permissions_decorator_1.Permissions)('FINANCE_DISCLOSURE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('noteCode')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ifrs_disclosure_note_query_dto_1.IfrsDisclosureNoteQueryDto]),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "getIfrs", null);
__decorate([
    (0, common_1.Get)('ifrs/:noteCode/export'),
    (0, permissions_decorator_1.Permissions)('FINANCE_REPORT_EXPORT', 'FINANCE_DISCLOSURE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('noteCode')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ifrs_disclosure_note_query_dto_1.IfrsDisclosureNoteQueryDto, Object]),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "exportIfrs", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_DISCLOSURE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DisclosureNotesController.prototype, "get", null);
exports.DisclosureNotesController = DisclosureNotesController = __decorate([
    (0, common_1.Controller)('reports/disclosure-notes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.UseGuards)(new tenant_rate_limit_guard_1.TenantRateLimitGuard(10_000, 30, 'disclosure-notes')),
    (0, common_1.UseInterceptors)(new timeout_interceptor_1.TimeoutInterceptor(15_000, 'DisclosureNotes')),
    __metadata("design:paramtypes", [disclosure_notes_service_1.DisclosureNotesService,
        ifrs_disclosure_notes_service_1.IfrsDisclosureNotesService,
        report_export_service_1.ReportExportService,
        disclosure_notes_audit_service_1.DisclosureNotesAuditService,
        prisma_service_1.PrismaService])
], DisclosureNotesController);
//# sourceMappingURL=disclosure-notes.controller.js.map