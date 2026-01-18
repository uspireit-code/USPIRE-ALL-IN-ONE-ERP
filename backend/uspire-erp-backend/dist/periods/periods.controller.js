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
exports.PeriodsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const permission_catalog_1 = require("../rbac/permission-catalog");
const create_accounting_period_dto_1 = require("../gl/dto/create-accounting-period.dto");
const reopen_period_dto_1 = require("../gl/dto/reopen-period.dto");
const periods_service_1 = require("./periods.service");
const correct_period_dto_1 = require("./dto/correct-period.dto");
let PeriodsController = class PeriodsController {
    periods;
    constructor(periods) {
        this.periods = periods;
    }
    async list(req) {
        return this.periods.listPeriods(req);
    }
    async create(req, dto) {
        return this.periods.createPeriod(req, dto);
    }
    async getChecklist(req, id) {
        return this.periods.getChecklist(req, id);
    }
    async completeChecklistItem(req, id, itemId) {
        return this.periods.completeChecklistItem(req, { periodId: id, itemId });
    }
    async close(req, id) {
        return this.periods.closePeriod(req, id);
    }
    async reopen(req, id, dto) {
        return this.periods.reopenPeriod(req, id, dto);
    }
    async correct(req, id, dto) {
        return this.periods.correctPeriod(req, id, dto);
    }
};
exports.PeriodsController = PeriodsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.PermissionsAny)(permission_catalog_1.PERMISSIONS.PERIOD.VIEW, permission_catalog_1.PERMISSIONS.PERIOD.REVIEW, permission_catalog_1.PERMISSIONS.GL.VIEW, permission_catalog_1.PERMISSIONS.AP.PAYMENT_RUN_EXECUTE),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.PERIOD.CREATE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_accounting_period_dto_1.CreateAccountingPeriodDto]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/checklist'),
    (0, permissions_decorator_1.PermissionsAny)(permission_catalog_1.PERMISSIONS.PERIOD.CHECKLIST_VIEW, permission_catalog_1.PERMISSIONS.PERIOD.VIEW, permission_catalog_1.PERMISSIONS.PERIOD.REVIEW, permission_catalog_1.PERMISSIONS.GL.VIEW),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "getChecklist", null);
__decorate([
    (0, common_1.Post)(':id/checklist/items/:itemId/complete'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.PERIOD.CHECKLIST_COMPLETE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "completeChecklistItem", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.PERIOD.CLOSE),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "close", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.PERIOD.REOPEN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reopen_period_dto_1.ReopenPeriodDto]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "reopen", null);
__decorate([
    (0, common_1.Patch)(':id/correct'),
    (0, permissions_decorator_1.Permissions)(permission_catalog_1.PERMISSIONS.PERIOD.CORRECT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, correct_period_dto_1.CorrectPeriodDto]),
    __metadata("design:returntype", Promise)
], PeriodsController.prototype, "correct", null);
exports.PeriodsController = PeriodsController = __decorate([
    (0, common_1.Controller)('periods'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [periods_service_1.PeriodsService])
], PeriodsController);
//# sourceMappingURL=periods.controller.js.map