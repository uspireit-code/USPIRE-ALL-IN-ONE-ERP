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
exports.GlRiskController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const gl_service_1 = require("./gl.service");
let GlRiskController = class GlRiskController {
    gl;
    constructor(gl) {
        this.gl = gl;
    }
    async overview(req, periodId, dateFrom, dateTo, legalEntityId, departmentId, projectId, fundId) {
        return this.gl.getJournalRiskOverview(req, {
            periodId,
            dateFrom,
            dateTo,
            legalEntityId,
            departmentId,
            projectId,
            fundId,
        });
    }
    async users(req, periodId, dateFrom, dateTo) {
        return this.gl.getJournalRiskUsers(req, { periodId, dateFrom, dateTo });
    }
    async accounts(req, periodId, dateFrom, dateTo, legalEntityId, departmentId, projectId, fundId) {
        return this.gl.getJournalRiskAccounts(req, {
            periodId,
            dateFrom,
            dateTo,
            legalEntityId,
            departmentId,
            projectId,
            fundId,
        });
    }
    async organisation(req, periodId, dateFrom, dateTo) {
        return this.gl.getJournalRiskOrganisation(req, {
            periodId,
            dateFrom,
            dateTo,
        });
    }
    async periods(req, periodId, dateFrom, dateTo) {
        return this.gl.getJournalRiskPeriods(req, { periodId, dateFrom, dateTo });
    }
};
exports.GlRiskController = GlRiskController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('periodId')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __param(4, (0, common_1.Query)('legalEntityId')),
    __param(5, (0, common_1.Query)('departmentId')),
    __param(6, (0, common_1.Query)('projectId')),
    __param(7, (0, common_1.Query)('fundId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GlRiskController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('periodId')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], GlRiskController.prototype, "users", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('periodId')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __param(4, (0, common_1.Query)('legalEntityId')),
    __param(5, (0, common_1.Query)('departmentId')),
    __param(6, (0, common_1.Query)('projectId')),
    __param(7, (0, common_1.Query)('fundId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GlRiskController.prototype, "accounts", null);
__decorate([
    (0, common_1.Get)('organisation'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('periodId')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], GlRiskController.prototype, "organisation", null);
__decorate([
    (0, common_1.Get)('periods'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('periodId')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], GlRiskController.prototype, "periods", null);
exports.GlRiskController = GlRiskController = __decorate([
    (0, common_1.Controller)('gl/risk'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [gl_service_1.GlService])
], GlRiskController);
//# sourceMappingURL=gl.risk.controller.js.map