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
exports.ArStatementsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../rbac/jwt-auth.guard");
const permission_catalog_1 = require("../../rbac/permission-catalog");
const permissions_decorator_1 = require("../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../rbac/permissions.guard");
const ar_statements_service_1 = require("./ar-statements.service");
let ArStatementsController = class ArStatementsController {
    statements;
    constructor(statements) {
        this.statements = statements;
    }
    async customers(req) {
        return this.statements.listCustomersForStatements(req);
    }
    async get(req, customerId, fromDate, toDate, asOfDate) {
        return this.statements.getStatement(req, { customerId, fromDate, toDate, asOfDate });
    }
};
exports.ArStatementsController = ArStatementsController;
__decorate([
    (0, common_1.Get)('customers'),
    (0, permissions_decorator_1.PermissionsAny)(permission_catalog_1.PERMISSIONS.AR_STATEMENT.VIEW, permission_catalog_1.PERMISSIONS.FINANCE.VIEW_ALL, permission_catalog_1.PERMISSIONS.SYSTEM.VIEW_ALL),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArStatementsController.prototype, "customers", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.PermissionsAny)(permission_catalog_1.PERMISSIONS.AR_STATEMENT.VIEW, permission_catalog_1.PERMISSIONS.FINANCE.VIEW_ALL, permission_catalog_1.PERMISSIONS.SYSTEM.VIEW_ALL),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('customerId')),
    __param(2, (0, common_1.Query)('fromDate')),
    __param(3, (0, common_1.Query)('toDate')),
    __param(4, (0, common_1.Query)('asOfDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ArStatementsController.prototype, "get", null);
exports.ArStatementsController = ArStatementsController = __decorate([
    (0, common_1.Controller)('ar/statements'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ar_statements_service_1.ArStatementsService])
], ArStatementsController);
//# sourceMappingURL=ar-statements.controller.js.map