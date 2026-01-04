"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("../prisma/prisma.module");
const storage_module_1 = require("../storage/storage.module");
const settings_controller_1 = require("./settings.controller");
const settings_service_1 = require("./settings.service");
const admin_role_guard_1 = require("./admin-role.guard");
const system_settings_read_guard_1 = require("./system-settings-read.guard");
let SettingsModule = class SettingsModule {
};
exports.SettingsModule = SettingsModule;
exports.SettingsModule = SettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), prisma_module_1.PrismaModule, storage_module_1.StorageModule],
        controllers: [settings_controller_1.SettingsController],
        providers: [settings_service_1.SettingsService, admin_role_guard_1.AdminRoleGuard, system_settings_read_guard_1.SystemSettingsReadGuard],
    })
], SettingsModule);
//# sourceMappingURL=settings.module.js.map