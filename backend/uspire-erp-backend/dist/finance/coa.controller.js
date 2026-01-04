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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const exceljs_1 = __importDefault(require("exceljs"));
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const coa_dto_1 = require("./coa.dto");
const coa_service_1 = require("./coa.service");
let CoaController = class CoaController {
    coa;
    constructor(coa) {
        this.coa = coa;
    }
    async list(req) {
        return this.coa.list(req);
    }
    async tree(req) {
        return this.coa.tree(req);
    }
    async create(req, dto) {
        return this.coa.create(req, dto);
    }
    async importCanonical(req, file) {
        return this.coa.importCanonical(req, file);
    }
    async importTemplate(req, format, res) {
        void req;
        const fmt = (format ?? 'csv').trim().toLowerCase();
        const headers = [
            'accountCode',
            'accountName',
            'category',
            'subCategory',
            'normalBalance',
            'fsMappingLevel1',
            'fsMappingLevel2',
            'parentAccountCode',
            'isControlAccount',
        ];
        if (fmt === 'xlsx') {
            const wb = new exceljs_1.default.Workbook();
            const ws = wb.addWorksheet('COA');
            ws.addRow(headers);
            const body = (await wb.xlsx.writeBuffer());
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="coa_import_template.xlsx"');
            res.send(body);
            return;
        }
        const escape = (v) => {
            const s = String(v ?? '');
            if (/[",\n\r]/.test(s))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const csv = [headers.map(escape).join(',')].join('\n') + '\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="coa_import_template.csv"');
        res.send(csv);
    }
    async get(req, id) {
        return this.coa.get(req, id);
    }
    async cleanupNonCanonical(req, dto) {
        return this.coa.cleanupNonCanonical(req, dto);
    }
    async setupTaxControlAccounts(req) {
        return this.coa.setupTaxControlAccounts(req);
    }
    async update(req, id, dto) {
        return this.coa.update(req, id, dto);
    }
    async put(req, id, dto) {
        return this.coa.update(req, id, dto);
    }
    async freeze(req) {
        return this.coa.freeze(req);
    }
    async unfreeze(req) {
        return this.coa.unfreeze(req);
    }
    async lock(req) {
        return this.coa.lock(req);
    }
    async unlock(req) {
        return this.coa.unlock(req);
    }
};
exports.CoaController = CoaController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('tree'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "tree", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, coa_dto_1.CreateCoaAccountDto]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "importCanonical", null);
__decorate([
    (0, common_1.Get)('import-template'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "importTemplate", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('cleanup-non-canonical'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "cleanupNonCanonical", null);
__decorate([
    (0, common_1.Post)('setup-tax-control-accounts'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "setupTaxControlAccounts", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, coa_dto_1.UpdateCoaAccountDto]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, coa_dto_1.UpdateCoaAccountDto]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "put", null);
__decorate([
    (0, common_1.Post)('freeze'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "freeze", null);
__decorate([
    (0, common_1.Post)('unfreeze'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "unfreeze", null);
__decorate([
    (0, common_1.Post)('lock'),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "lock", null);
__decorate([
    (0, common_1.Post)('unlock'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, permissions_decorator_1.Permissions)('FINANCE_COA_UNLOCK'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CoaController.prototype, "unlock", null);
exports.CoaController = CoaController = __decorate([
    (0, common_1.Controller)('finance/coa'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [coa_service_1.CoaService])
], CoaController);
//# sourceMappingURL=coa.controller.js.map