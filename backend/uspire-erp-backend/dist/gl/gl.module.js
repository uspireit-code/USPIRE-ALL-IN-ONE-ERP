"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const rbac_module_1 = require("../rbac/rbac.module");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const reports_module_1 = require("../reports/reports.module");
const storage_module_1 = require("../storage/storage.module");
const gl_controller_1 = require("./gl.controller");
const gl_risk_controller_1 = require("./gl.risk.controller");
const gl_service_1 = require("./gl.service");
const review_pack_service_1 = require("./review-pack.service");
let GlModule = class GlModule {
};
exports.GlModule = GlModule;
exports.GlModule = GlModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            jwt_1.JwtModule.register({}),
            rbac_module_1.RbacModule,
            storage_module_1.StorageModule,
            reports_module_1.ReportsModule,
        ],
        controllers: [gl_controller_1.GlController, gl_risk_controller_1.GlRiskController],
        providers: [gl_service_1.GlService, review_pack_service_1.ReviewPackService, jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard],
        exports: [gl_service_1.GlService],
    })
], GlModule);
//# sourceMappingURL=gl.module.js.map