"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const budgets_service_1 = require("../budgets/budgets.service");
const forecasts_service_1 = require("../forecasts/forecasts.service");
const financial_statements_service_1 = require("../reports/financial-statements.service");
const reports_service_1 = require("../reports/reports.service");
const dashboard_controller_1 = require("./dashboard.controller");
const dashboard_service_1 = require("./dashboard.service");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), rbac_module_1.RbacModule],
        controllers: [dashboard_controller_1.DashboardController],
        providers: [
            dashboard_service_1.DashboardService,
            financial_statements_service_1.FinancialStatementsService,
            reports_service_1.ReportsService,
            budgets_service_1.BudgetsService,
            forecasts_service_1.ForecastsService,
            jwt_auth_guard_1.JwtAuthGuard,
            permissions_guard_1.PermissionsGuard,
        ],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map