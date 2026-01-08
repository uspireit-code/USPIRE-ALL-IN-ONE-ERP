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
exports.ArRemindersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../../rbac/permissions.decorator");
const permissions_guard_1 = require("../../rbac/permissions.guard");
const ar_reminders_service_1 = require("./ar-reminders.service");
let ArRemindersController = class ArRemindersController {
    reminders;
    constructor(reminders) {
        this.reminders = reminders;
    }
    async listRules(req) {
        return this.reminders.listRules(req);
    }
    async upsertRule(req, body) {
        return this.reminders.upsertRule(req, body);
    }
    async listTemplates(req) {
        return this.reminders.listTemplates(req);
    }
    async upsertTemplate(req, body) {
        return this.reminders.upsertTemplate(req, body);
    }
    async send(req, body) {
        return this.reminders.sendReminder(req, {
            invoiceId: body.invoiceId,
            triggerMode: body.triggerMode ?? 'MANUAL',
            reminderRuleId: body.reminderRuleId,
        });
    }
};
exports.ArRemindersController = ArRemindersController;
__decorate([
    (0, common_1.Get)('rules'),
    (0, permissions_decorator_1.PermissionsAny)('AR_REMINDER_VIEW', 'FINANCE_VIEW_ALL', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArRemindersController.prototype, "listRules", null);
__decorate([
    (0, common_1.Post)('rules'),
    (0, permissions_decorator_1.Permissions)('AR_REMINDER_CONFIGURE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ArRemindersController.prototype, "upsertRule", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, permissions_decorator_1.PermissionsAny)('AR_REMINDER_VIEW', 'FINANCE_VIEW_ALL', 'SYSTEM_VIEW_ALL'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ArRemindersController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Post)('templates'),
    (0, permissions_decorator_1.Permissions)('AR_REMINDER_CONFIGURE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ArRemindersController.prototype, "upsertTemplate", null);
__decorate([
    (0, common_1.Post)('send'),
    (0, permissions_decorator_1.Permissions)('AR_REMINDER_TRIGGER'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ArRemindersController.prototype, "send", null);
exports.ArRemindersController = ArRemindersController = __decorate([
    (0, common_1.Controller)('ar/reminders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ar_reminders_service_1.ArRemindersService])
], ArRemindersController);
//# sourceMappingURL=ar-reminders.controller.js.map