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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const settings_service_1 = require("./settings.service");
const update_organisation_dto_1 = require("./dto/update-organisation.dto");
const update_system_config_dto_1 = require("./dto/update-system-config.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_status_dto_1 = require("./dto/update-user-status.dto");
const update_user_roles_dto_1 = require("./dto/update-user-roles.dto");
const validate_user_roles_dto_1 = require("./dto/validate-user-roles.dto");
let SettingsController = class SettingsController {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    async getOrganisation(req) {
        return this.settings.getOrganisation(req);
    }
    async updateOrganisation(req, dto) {
        return this.settings.updateOrganisation(req, dto);
    }
    async uploadLogo(req, file) {
        return this.settings.uploadOrganisationLogo(req, file);
    }
    async downloadLogo(req, res) {
        const out = await this.settings.downloadOrganisationLogo(req);
        res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async getSystemConfig(req) {
        return this.settings.getSystemConfig(req);
    }
    async updateSystemConfig(req, dto) {
        return this.settings.updateSystemConfig(req, dto);
    }
    async uploadFavicon(req, file) {
        return this.settings.uploadTenantFavicon(req, file);
    }
    async downloadFavicon(req, res) {
        const out = await this.settings.downloadTenantFavicon(req);
        res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
        res.send(out.body);
    }
    async listUsers(req) {
        return this.settings.listUsers(req);
    }
    async listRoles(req) {
        return this.settings.listRoles(req);
    }
    async validateRoles(req, dto) {
        return this.settings.validateRoles(req, dto);
    }
    async createUser(req, dto) {
        return this.settings.createUser(req, dto);
    }
    async updateUserStatus(req, id, dto) {
        return this.settings.updateUserStatus(req, id, dto);
    }
    async updateUserRoles(req, id, dto) {
        return this.settings.updateUserRoles(req, id, dto);
    }
    async listRolesWithPermissions(req) {
        return this.settings.listRolesWithPermissions(req);
    }
    async getRoleDetails(req, id) {
        return this.settings.getRoleDetails(req, id);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('organisation'),
    (0, permissions_decorator_1.PermissionsAny)('SYSTEM_CONFIG_VIEW', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getOrganisation", null);
__decorate([
    (0, common_1.Put)('organisation'),
    (0, permissions_decorator_1.Permissions)('SYSTEM_CONFIG_UPDATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organisation_dto_1.UpdateOrganisationDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateOrganisation", null);
__decorate([
    (0, common_1.Post)('organisation/logo'),
    (0, permissions_decorator_1.Permissions)('SYSTEM_CONFIG_UPDATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "uploadLogo", null);
__decorate([
    (0, common_1.Get)('organisation/logo'),
    (0, permissions_decorator_1.PermissionsAny)('SYSTEM_CONFIG_VIEW', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "downloadLogo", null);
__decorate([
    (0, common_1.Get)('system'),
    (0, permissions_decorator_1.PermissionsAny)('SYSTEM_CONFIG_VIEW', 'FINANCE_CONFIG_VIEW', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSystemConfig", null);
__decorate([
    (0, common_1.Put)('system'),
    (0, permissions_decorator_1.PermissionsAny)('SYSTEM_CONFIG_UPDATE', 'FINANCE_CONFIG_UPDATE', 'FINANCE_CONFIG_CHANGE', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_system_config_dto_1.UpdateSystemConfigDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSystemConfig", null);
__decorate([
    (0, common_1.Post)('system/favicon'),
    (0, permissions_decorator_1.Permissions)('SYSTEM_CONFIG_UPDATE'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 2 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "uploadFavicon", null);
__decorate([
    (0, common_1.Get)('system/favicon'),
    (0, permissions_decorator_1.PermissionsAny)('SYSTEM_CONFIG_VIEW', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "downloadFavicon", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, permissions_decorator_1.Permissions)('USER_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)('users/roles'),
    (0, permissions_decorator_1.Permissions)('ROLE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Post)('users/roles/validate'),
    (0, permissions_decorator_1.Permissions)('ROLE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, validate_user_roles_dto_1.ValidateUserRolesDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "validateRoles", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, permissions_decorator_1.Permissions)('USER_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/status'),
    (0, permissions_decorator_1.Permissions)('USER_EDIT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_user_status_dto_1.UpdateUserStatusDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Patch)('users/:id/roles'),
    (0, permissions_decorator_1.Permissions)('ROLE_ASSIGN'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_user_roles_dto_1.UpdateUserRolesDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateUserRoles", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, permissions_decorator_1.Permissions)('ROLE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "listRolesWithPermissions", null);
__decorate([
    (0, common_1.Get)('roles/:id'),
    (0, permissions_decorator_1.Permissions)('ROLE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getRoleDetails", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map