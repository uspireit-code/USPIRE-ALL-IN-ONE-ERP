"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForecastsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("../prisma/prisma.module");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const forecasts_controller_1 = require("./forecasts.controller");
const forecasts_service_1 = require("./forecasts.service");
let ForecastsModule = class ForecastsModule {
};
exports.ForecastsModule = ForecastsModule;
exports.ForecastsModule = ForecastsModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), rbac_module_1.RbacModule, prisma_module_1.PrismaModule],
        controllers: [forecasts_controller_1.ForecastsController],
        providers: [forecasts_service_1.ForecastsService, jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard],
    })
], ForecastsModule);
//# sourceMappingURL=forecasts.module.js.map