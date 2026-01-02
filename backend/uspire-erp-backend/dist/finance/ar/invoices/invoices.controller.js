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
exports.FinanceArInvoicesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../../../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../../rbac/permissions.guard");
const invoices_dto_1 = require("./invoices.dto");
const invoices_service_1 = require("./invoices.service");
let FinanceArInvoicesController = class FinanceArInvoicesController {
    invoices;
    constructor(invoices) {
        this.invoices = invoices;
    }
    async list(req, q) {
        return this.invoices.list(req, q);
    }
    async create(req, dto) {
        return this.invoices.create(req, dto);
    }
    async import(req, file) {
        return this.invoices.import(req, file);
    }
    async previewImport(req, file) {
        return this.invoices.previewImport(req, file);
    }
    async downloadImportCsvTemplate(req, res) {
        const out = await this.invoices.getImportCsvTemplate(req);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async downloadImportXlsxTemplate(req, res) {
        const out = await this.invoices.getImportXlsxTemplate(req);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async getById(req, id) {
        return this.invoices.getById(req, id);
    }
    async exportInvoice(req, id, format, res) {
        const out = await this.invoices.exportInvoice(req, id, {
            format: (format || 'html'),
        });
        res.setHeader('Content-Type', out.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async postInvoice(req, id, dto) {
        return this.invoices.post(req, id, {
            arControlAccountCode: dto.arControlAccountCode,
        });
    }
};
exports.FinanceArInvoicesController = FinanceArInvoicesController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, invoices_dto_1.ListInvoicesQueryDto]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, invoices_dto_1.CreateCustomerInvoiceDto]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "import", null);
__decorate([
    (0, common_1.Post)('import/preview'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "previewImport", null);
__decorate([
    (0, common_1.Get)('import/template.csv'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "downloadImportCsvTemplate", null);
__decorate([
    (0, common_1.Get)('import/template.xlsx'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "downloadImportXlsxTemplate", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "exportInvoice", null);
__decorate([
    (0, common_1.Post)(':id/post'),
    (0, permissions_decorator_1.Permissions)('AR_INVOICE_POST'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, invoices_dto_1.PostInvoiceDto]),
    __metadata("design:returntype", Promise)
], FinanceArInvoicesController.prototype, "postInvoice", null);
exports.FinanceArInvoicesController = FinanceArInvoicesController = __decorate([
    (0, common_1.Controller)('finance/ar/invoices'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [invoices_service_1.FinanceArInvoicesService])
], FinanceArInvoicesController);
//# sourceMappingURL=invoices.controller.js.map