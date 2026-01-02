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
exports.FinanceArCustomersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../../../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../../rbac/permissions.guard");
const customers_dto_1 = require("./customers.dto");
const customers_service_1 = require("./customers.service");
let FinanceArCustomersController = class FinanceArCustomersController {
    customers;
    constructor(customers) {
        this.customers = customers;
    }
    async list(req, q) {
        return this.customers.list(req, q);
    }
    async create(req, dto) {
        return this.customers.create(req, dto);
    }
    async update(req, id, dto) {
        return this.customers.update(req, id, dto);
    }
    async import(req, file) {
        return this.customers.import(req, file);
    }
};
exports.FinanceArCustomersController = FinanceArCustomersController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('CUSTOMERS_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, customers_dto_1.ListCustomersQueryDto]),
    __metadata("design:returntype", Promise)
], FinanceArCustomersController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('CUSTOMERS_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, customers_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", Promise)
], FinanceArCustomersController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.Permissions)('CUSTOMERS_EDIT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customers_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", Promise)
], FinanceArCustomersController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, permissions_decorator_1.Permissions)('CUSTOMERS_IMPORT'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceArCustomersController.prototype, "import", null);
exports.FinanceArCustomersController = FinanceArCustomersController = __decorate([
    (0, common_1.Controller)('finance/ar/customers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [customers_service_1.FinanceArCustomersService])
], FinanceArCustomersController);
//# sourceMappingURL=customers.controller.js.map