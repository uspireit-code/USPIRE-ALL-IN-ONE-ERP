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
exports.FinanceArRefundsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../../rbac/permissions.guard");
const permission_catalog_1 = require("../../../rbac/permission-catalog");
const refunds_dto_1 = require("./refunds.dto");
const refunds_service_1 = require("./refunds.service");
let FinanceArRefundsController = class FinanceArRefundsController {
    refunds;
    constructor(refunds) {
        this.refunds = refunds;
    }
    async list(req, q) {
        return this.refunds.list(req, q);
    }
    async listRefundableCreditNotes(req, customerId) {
        return this.refunds.listRefundableCreditNotes(req, customerId);
    }
    async listRefundableCustomers(req) {
        return this.refunds.listRefundableCustomers(req);
    }
    async refundable(req, creditNoteId) {
        return this.refunds.getRefundableForCreditNote(req, creditNoteId);
    }
    async getById(req, id) {
        return this.refunds.getById(req, id);
    }
    async exportPdf(req, id, res) {
        const body = await this.refunds.exportPdf(req, id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="refund-${id}.pdf"`);
        res.send(body);
    }
    async create(req, dto) {
        return this.refunds.create(req, dto);
    }
    async submit(req, id, _dto) {
        return this.refunds.submit(req, id);
    }
    async approve(req, id, _dto) {
        return this.refunds.approve(req, id);
    }
    async post(req, id, _dto) {
        return this.refunds.post(req, id);
    }
    async void(req, id, dto) {
        return this.refunds.void(req, id, dto);
    }
};
exports.FinanceArRefundsController = FinanceArRefundsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, refunds_dto_1.ListRefundsQueryDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('refundable-credit-notes'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "listRefundableCreditNotes", null);
__decorate([
    (0, common_1.Get)('refundable-customers'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_CREATE),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "listRefundableCustomers", null);
__decorate([
    (0, common_1.Get)('credit-notes/:creditNoteId/refundable'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('creditNoteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "refundable", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "exportPdf", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, refunds_dto_1.CreateCustomerRefundDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_SUBMIT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, refunds_dto_1.SubmitRefundDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_APPROVE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, refunds_dto_1.ApproveRefundDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/post'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_POST),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, refunds_dto_1.PostRefundDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "post", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AR.REFUND_VOID),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, refunds_dto_1.VoidRefundDto]),
    __metadata("design:returntype", Promise)
], FinanceArRefundsController.prototype, "void", null);
exports.FinanceArRefundsController = FinanceArRefundsController = __decorate([
    (0, common_1.Controller)('finance/ar/refunds'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [refunds_service_1.FinanceArRefundsService])
], FinanceArRefundsController);
//# sourceMappingURL=refunds.controller.js.map