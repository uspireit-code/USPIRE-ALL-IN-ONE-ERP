"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("../prisma/prisma.module");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const storage_module_1 = require("../storage/storage.module");
const audit_controller_1 = require("./audit.controller");
const audit_evidence_controller_1 = require("./audit-evidence.controller");
const audit_evidence_service_1 = require("./audit-evidence.service");
const audit_service_1 = require("./audit.service");
let AuditModule = class AuditModule {
};
exports.AuditModule = AuditModule;
exports.AuditModule = AuditModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            jwt_1.JwtModule.register({}),
            rbac_module_1.RbacModule,
            prisma_module_1.PrismaModule,
            storage_module_1.StorageModule,
        ],
        controllers: [audit_controller_1.AuditController, audit_evidence_controller_1.AuditEvidenceController],
        providers: [
            audit_service_1.AuditService,
            audit_evidence_service_1.AuditEvidenceService,
            jwt_auth_guard_1.JwtAuthGuard,
            permissions_guard_1.PermissionsGuard,
        ],
    })
], AuditModule);
//# sourceMappingURL=audit.module.js.map