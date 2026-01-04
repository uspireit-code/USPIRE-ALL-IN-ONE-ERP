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
exports.ApController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const ap_service_1 = require("./ap.service");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const create_supplier_invoice_dto_1 = require("./dto/create-supplier-invoice.dto");
const post_invoice_dto_1 = require("./dto/post-invoice.dto");
let ApController = class ApController {
    ap;
    constructor(ap) {
        this.ap = ap;
    }
    async createSupplier(req, dto) {
        return this.ap.createSupplier(req, dto);
    }
    async listSuppliers(req) {
        return this.ap.listSuppliers(req);
    }
    async listEligibleAccounts(req) {
        return this.ap.listEligibleAccounts(req);
    }
    async createInvoice(req, dto) {
        return this.ap.createInvoice(req, dto);
    }
    async submitInvoice(req, id) {
        return this.ap.submitInvoice(req, id);
    }
    async approveInvoice(req, id) {
        return this.ap.approveInvoice(req, id);
    }
    async postInvoice(req, id, dto) {
        return this.ap.postInvoice(req, id, {
            apControlAccountCode: dto.apControlAccountCode,
        });
    }
    async listInvoices(req) {
        return this.ap.listInvoices(req);
    }
};
exports.ApController = ApController;
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, permissions_decorator_1.Permissions)('AP_SUPPLIER_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listSuppliers", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listEligibleAccounts", null);
__decorate([
    (0, common_1.Post)('invoices'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_invoice_dto_1.CreateSupplierInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createInvoice", null);
__decorate([
    (0, common_1.Post)('invoices/:id/submit'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_SUBMIT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "submitInvoice", null);
__decorate([
    (0, common_1.Post)('invoices/:id/approve'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "approveInvoice", null);
__decorate([
    (0, common_1.Post)('invoices/:id/post'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, post_invoice_dto_1.PostInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "postInvoice", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, permissions_decorator_1.Permissions)('AP_INVOICE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listInvoices", null);
exports.ApController = ApController = __decorate([
    (0, common_1.Controller)('ap'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ap_service_1.ApService])
], ApController);
//# sourceMappingURL=ap.controller.js.map