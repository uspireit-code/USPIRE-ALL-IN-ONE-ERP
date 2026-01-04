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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const timeout_interceptor_1 = require("../internal/timeout.interceptor");
const tenant_rate_limit_guard_1 = require("../internal/tenant-rate-limit.guard");
const dashboard_query_dto_1 = require("./dto/dashboard-query.dto");
const dashboard_service_1 = require("./dashboard.service");
let DashboardController = class DashboardController {
    dashboard;
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    async summary(req, query) {
        const data = await this.dashboard.getKpis(req, query);
        await this.dashboard.auditDashboardView(req, {
            dashboardType: 'summary',
            context: data.context,
        });
        return data;
    }
    async kpis(req, query) {
        const data = await this.dashboard.getKpis(req, query);
        await this.dashboard.auditDashboardView(req, {
            dashboardType: 'kpis',
            context: data.context,
        });
        return data;
    }
    async trends(req, query) {
        const data = await this.dashboard.getTrends(req, query);
        await this.dashboard.auditDashboardView(req, {
            dashboardType: 'trends',
            context: data.context,
        });
        return data;
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, permissions_decorator_1.Permissions)('dashboard.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dashboard_query_dto_1.DashboardQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, permissions_decorator_1.Permissions)('dashboard.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dashboard_query_dto_1.DashboardQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "kpis", null);
__decorate([
    (0, common_1.Get)('trends'),
    (0, permissions_decorator_1.Permissions)('dashboard.view'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dashboard_query_dto_1.DashboardQueryDto]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "trends", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.UseGuards)(new tenant_rate_limit_guard_1.TenantRateLimitGuard(10_000, 30, 'dashboard')),
    (0, common_1.UseInterceptors)(new timeout_interceptor_1.TimeoutInterceptor(10_000, 'Dashboard')),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map