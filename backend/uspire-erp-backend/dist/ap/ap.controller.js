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
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const permission_catalog_1 = require("../rbac/permission-catalog");
const ap_service_1 = require("./ap.service");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const create_supplier_invoice_dto_1 = require("./dto/create-supplier-invoice.dto");
const post_invoice_dto_1 = require("./dto/post-invoice.dto");
const upload_supplier_document_dto_1 = require("./dto/upload-supplier-document.dto");
const create_supplier_bank_account_dto_1 = require("./dto/create-supplier-bank-account.dto");
const update_supplier_bank_account_dto_1 = require("./dto/update-supplier-bank-account.dto");
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
    async downloadSupplierImportTemplate(req, res) {
        const out = await this.ap.getSupplierImportCsvTemplate(req);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async previewSupplierImport(req, file) {
        return this.ap.previewSupplierImport(req, file);
    }
    async commitSupplierImport(req, payload) {
        return this.ap.commitSupplierImport(req, payload?.rows ?? []);
    }
    async listSupplierDocuments(req, id) {
        return this.ap.listSupplierDocuments(req, id);
    }
    async uploadSupplierDocument(req, id, file, dto) {
        return this.ap.uploadSupplierDocument(req, id, dto, file);
    }
    async deactivateSupplierDocument(req, id, docId) {
        return this.ap.deactivateSupplierDocument(req, id, docId);
    }
    async downloadSupplierDocument(req, id, docId, res) {
        const out = await this.ap.downloadSupplierDocument(req, id, docId);
        res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', String(out.size ?? out.body.length));
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async listSupplierBankAccounts(req, id) {
        return this.ap.listSupplierBankAccounts(req, id);
    }
    async createSupplierBankAccount(req, id, dto) {
        return this.ap.createSupplierBankAccount(req, id, dto);
    }
    async updateSupplierBankAccount(req, id, bankId, dto) {
        return this.ap.updateSupplierBankAccount(req, id, bankId, dto);
    }
    async deactivateSupplierBankAccount(req, id, bankId) {
        return this.ap.deactivateSupplierBankAccount(req, id, bankId);
    }
    async setPrimarySupplierBankAccount(req, id, bankId) {
        return this.ap.setPrimarySupplierBankAccount(req, id, bankId);
    }
    async listSupplierChangeHistory(req, id) {
        return this.ap.listSupplierChangeHistory(req, id);
    }
    async listEligibleAccounts(req) {
        return this.ap.listEligibleAccounts(req);
    }
    async createInvoice(req, dto) {
        return this.ap.createInvoice(req, dto);
    }
    async createBill(req, dto) {
        return this.ap.createInvoice(req, dto);
    }
    async submitInvoice(req, id) {
        return this.ap.submitInvoice(req, id);
    }
    async submitBill(req, id) {
        return this.ap.submitInvoice(req, id);
    }
    async approveInvoice(req, id) {
        return this.ap.approveInvoice(req, id);
    }
    async approveBill(req, id) {
        return this.ap.approveInvoice(req, id);
    }
    async postInvoice(req, id, dto) {
        return this.ap.postInvoice(req, id, {
            apControlAccountCode: dto.apControlAccountCode,
        });
    }
    async postBill(req, id, dto) {
        return this.ap.postInvoice(req, id, {
            apControlAccountCode: dto.apControlAccountCode,
        });
    }
    async listInvoices(req) {
        return this.ap.listInvoices(req);
    }
    async listBills(req) {
        return this.ap.listInvoices(req);
    }
};
exports.ApController = ApController;
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_VIEW),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listSuppliers", null);
__decorate([
    (0, common_1.Get)('suppliers/import/template.csv'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_IMPORT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "downloadSupplierImportTemplate", null);
__decorate([
    (0, common_1.Post)('suppliers/import/preview'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_IMPORT),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "previewSupplierImport", null);
__decorate([
    (0, common_1.Post)('suppliers/import/commit'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_IMPORT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "commitSupplierImport", null);
__decorate([
    (0, common_1.Get)('suppliers/:id/documents'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listSupplierDocuments", null);
__decorate([
    (0, common_1.Post)('suppliers/:id/documents'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 25 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, upload_supplier_document_dto_1.UploadSupplierDocumentDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "uploadSupplierDocument", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id/documents/:docId/deactivate'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "deactivateSupplierDocument", null);
__decorate([
    (0, common_1.Get)('suppliers/:id/documents/:docId/download'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "downloadSupplierDocument", null);
__decorate([
    (0, common_1.Get)('suppliers/:id/bank-accounts'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listSupplierBankAccounts", null);
__decorate([
    (0, common_1.Post)('suppliers/:id/bank-accounts'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_supplier_bank_account_dto_1.CreateSupplierBankAccountDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createSupplierBankAccount", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id/bank-accounts/:bankId'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('bankId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_supplier_bank_account_dto_1.UpdateSupplierBankAccountDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "updateSupplierBankAccount", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id/bank-accounts/:bankId/deactivate'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('bankId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "deactivateSupplierBankAccount", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id/bank-accounts/:bankId/set-primary'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('bankId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "setPrimarySupplierBankAccount", null);
__decorate([
    (0, common_1.Get)('suppliers/:id/change-history'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.SUPPLIER_VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listSupplierChangeHistory", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_CREATE),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listEligibleAccounts", null);
__decorate([
    (0, common_1.Post)('invoices'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_invoice_dto_1.CreateSupplierInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createInvoice", null);
__decorate([
    (0, common_1.Post)('bills'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.BILL_CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_invoice_dto_1.CreateSupplierInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "createBill", null);
__decorate([
    (0, common_1.Post)('invoices/:id/submit'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_SUBMIT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "submitInvoice", null);
__decorate([
    (0, common_1.Post)('bills/:id/submit'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.BILL_SUBMIT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "submitBill", null);
__decorate([
    (0, common_1.Post)('invoices/:id/approve'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_APPROVE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "approveInvoice", null);
__decorate([
    (0, common_1.Post)('bills/:id/approve'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.BILL_APPROVE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "approveBill", null);
__decorate([
    (0, common_1.Post)('invoices/:id/post'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_POST),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, post_invoice_dto_1.PostInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "postInvoice", null);
__decorate([
    (0, common_1.Post)('bills/:id/post'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.BILL_POST),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, post_invoice_dto_1.PostInvoiceDto]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "postBill", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.INVOICE_VIEW),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listInvoices", null);
__decorate([
    (0, common_1.Get)('bills'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.AP.BILL_VIEW),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApController.prototype, "listBills", null);
exports.ApController = ApController = __decorate([
    (0, common_1.Controller)('ap'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ap_service_1.ApService])
], ApController);
//# sourceMappingURL=ap.controller.js.map