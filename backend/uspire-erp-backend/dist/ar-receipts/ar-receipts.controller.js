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
exports.ArReceiptsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const ar_receipts_service_1 = require("./ar-receipts.service");
const create_receipt_dto_1 = require("./dto/create-receipt.dto");
const set_receipt_allocations_dto_1 = require("./dto/set-receipt-allocations.dto");
const update_receipt_dto_1 = require("./dto/update-receipt.dto");
const void_receipt_dto_1 = require("./dto/void-receipt.dto");
let ArReceiptsController = class ArReceiptsController {
    receipts;
    constructor(receipts) {
        this.receipts = receipts;
    }
    async list(req) {
        return this.receipts.listReceipts(req);
    }
    async listOutstandingInvoices(req, customerId, currency) {
        return this.receipts.listCustomerOutstandingInvoices(req, customerId, currency);
    }
    async getById(id, req) {
        return this.receipts.getReceiptById(req, id);
    }
    async exportReceipt(req, id, format, res) {
        const out = await this.receipts.exportReceipt(req, id, {
            format: (format || 'html'),
        });
        res.setHeader('Content-Type', out.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async listAllocations(id, req) {
        return this.receipts.listAllocations(req, id);
    }
    async setAllocations(id, req, dto) {
        return this.receipts.setAllocations(req, id, dto);
    }
    async create(req, dto) {
        return this.receipts.createReceipt(req, dto);
    }
    async update(req, id, dto) {
        return this.receipts.updateReceipt(req, id, dto);
    }
    async post(req, id) {
        return this.receipts.postReceipt(req, id);
    }
    async void(req, id, dto) {
        return this.receipts.voidReceipt(req, id, dto.reason);
    }
};
exports.ArReceiptsController = ArReceiptsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('customers/:customerId/outstanding-invoices'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('customerId')),
    __param(2, (0, common_1.Query)('currency')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "listOutstandingInvoices", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "exportReceipt", null);
__decorate([
    (0, common_1.Get)(':id/allocations'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_VIEW'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "listAllocations", null);
__decorate([
    (0, common_1.Put)(':id/allocations'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_CREATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, set_receipt_allocations_dto_1.SetReceiptAllocationsDto]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "setAllocations", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_receipt_dto_1.CreateReceiptDto]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_receipt_dto_1.UpdateReceiptDto]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/post'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPTS_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "post", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    (0, permissions_decorator_1.Permissions)('AR_RECEIPT_VOID'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, void_receipt_dto_1.VoidReceiptDto]),
    __metadata("design:returntype", Promise)
], ArReceiptsController.prototype, "void", null);
exports.ArReceiptsController = ArReceiptsController = __decorate([
    (0, common_1.Controller)('ar/receipts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ar_receipts_service_1.ArReceiptsService])
], ArReceiptsController);
//# sourceMappingURL=ar-receipts.controller.js.map