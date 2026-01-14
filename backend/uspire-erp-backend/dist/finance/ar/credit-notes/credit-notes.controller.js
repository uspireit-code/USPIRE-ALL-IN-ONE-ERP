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
exports.FinanceArCreditNotesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../../rbac/permissions.guard");
const permission_catalog_1 = require("../../../rbac/permission-catalog");
const credit_notes_dto_1 = require("./credit-notes.dto");
const credit_notes_service_1 = require("./credit-notes.service");
let FinanceArCreditNotesController = class FinanceArCreditNotesController {
    creditNotes;
    constructor(creditNotes) {
        this.creditNotes = creditNotes;
    }
    async list(req, q) {
        return this.creditNotes.list(req, q);
    }
    async eligibleCustomers(req) {
        return this.creditNotes.listEligibleCustomers(req);
    }
    async eligibleInvoices(req, customerId) {
        return this.creditNotes.listEligibleInvoices(req, customerId);
    }
    async getById(req, id) {
        return this.creditNotes.getById(req, id);
    }
    async exportPdf(req, id, res) {
        const body = await this.creditNotes.exportPdf(req, id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="credit-note-${id}.pdf"`);
        res.send(body);
    }
    async create(req, dto) {
        return this.creditNotes.create(req, dto);
    }
    async submit(req, id, dto) {
        return this.creditNotes.submit(req, id, dto);
    }
    async approve(req, id, dto) {
        return this.creditNotes.approve(req, id, dto);
    }
    async post(req, id, _dto) {
        return this.creditNotes.post(req, id);
    }
    async void(req, id, dto) {
        return this.creditNotes.void(req, id, dto);
    }
};
exports.FinanceArCreditNotesController = FinanceArCreditNotesController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, credit_notes_dto_1.ListCreditNotesQueryDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('eligible-customers'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_CREATE),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "eligibleCustomers", null);
__decorate([
    (0, common_1.Get)('eligible-invoices'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "eligibleInvoices", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, credit_notes_dto_1.CreateCustomerCreditNoteDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, credit_notes_dto_1.SubmitCreditNoteDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_APPROVE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, credit_notes_dto_1.ApproveCreditNoteDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/post'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_POST),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, credit_notes_dto_1.PostCreditNoteDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "post", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.CREDIT_NOTE_VOID),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, credit_notes_dto_1.VoidCreditNoteDto]),
    __metadata("design:returntype", Promise)
], FinanceArCreditNotesController.prototype, "void", null);
exports.FinanceArCreditNotesController = FinanceArCreditNotesController = __decorate([
    (0, common_1.Controller)('finance/ar/credit-notes'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [credit_notes_service_1.FinanceArCreditNotesService])
], FinanceArCreditNotesController);
//# sourceMappingURL=credit-notes.controller.js.map