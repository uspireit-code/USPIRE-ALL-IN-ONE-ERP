"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("../prisma/prisma.module");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const ar_controller_1 = require("./ar.controller");
const ar_service_1 = require("./ar.service");
const ar_aging_controller_1 = require("./aging/ar-aging.controller");
const ar_aging_service_1 = require("./aging/ar-aging.service");
const ar_reminders_controller_1 = require("./reminders/ar-reminders.controller");
const ar_reminders_service_1 = require("./reminders/ar-reminders.service");
const ar_statements_controller_1 = require("./statements/ar-statements.controller");
const ar_statements_service_1 = require("./statements/ar-statements.service");
let ArModule = class ArModule {
};
exports.ArModule = ArModule;
exports.ArModule = ArModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), prisma_module_1.PrismaModule, rbac_module_1.RbacModule],
        controllers: [ar_controller_1.ArController, ar_aging_controller_1.ArAgingController, ar_statements_controller_1.ArStatementsController, ar_reminders_controller_1.ArRemindersController],
        providers: [ar_service_1.ArService, ar_aging_service_1.ArAgingService, ar_statements_service_1.ArStatementsService, ar_reminders_service_1.ArRemindersService, jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard],
    })
], ArModule);
//# sourceMappingURL=ar.module.js.map