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
exports.ArController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const ar_service_1 = require("./ar.service");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const create_customer_invoice_dto_1 = require("./dto/create-customer-invoice.dto");
const post_customer_invoice_dto_1 = require("./dto/post-customer-invoice.dto");
let ArController = class ArController {
    ar;
    constructor(ar) {
        this.ar = ar;
    }
    async createCustomer(req, dto) {
        return this.ar.createCustomer(req, dto);
    }
    async listCustomers(req) {
        return this.ar.listCustomers(req);
    }
    async listEligibleAccounts(req) {
        return this.ar.listEligibleAccounts(req);
    }
    async createInvoice(req, dto) {
        return this.ar.createInvoice(req, dto);
    }
    async postInvoice(req, id, dto) {
        return this.ar.postInvoice(req, id, {
            arControlAccountCode: dto.arControlAccountCode,
        });
    }
    async listInvoices(req) {
        return this.ar.listInvoices(req);
    }
};
exports.ArController = ArController;
__decorate([
    (0, common_1.Post)('customers'),
    (0, permissions_decorator_1.Permissions)('AR_CUSTOMER_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_customer_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "createCustomer", null);
__decorate([
    (0, common_1.Get)('customers'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "listCustomers", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "listEligibleAccounts", null);
__decorate([
    (0, common_1.Post)('invoices'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_customer_invoice_dto_1.CreateCustomerInvoiceDto]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "createInvoice", null);
__decorate([
    (0, common_1.Post)('invoices/:id/post'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, post_customer_invoice_dto_1.PostCustomerInvoiceDto]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "postInvoice", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArController.prototype, "listInvoices", null);
exports.ArController = ArController = __decorate([
    (0, common_1.Controller)('ar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ar_service_1.ArService])
], ArController);
//# sourceMappingURL=ar.controller.js.map