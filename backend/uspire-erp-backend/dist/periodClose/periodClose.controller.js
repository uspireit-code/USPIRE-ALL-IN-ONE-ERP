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
exports.PeriodCloseController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const periodClose_service_1 = require("./periodClose.service");
let PeriodCloseController = class PeriodCloseController {
    periodClose;
    constructor(periodClose) {
        this.periodClose = periodClose;
    }
    async getChecklist(req, periodId) {
        return this.periodClose.getChecklist(req, periodId);
    }
    async completeItem(req, periodId, itemId) {
        return this.periodClose.completeItem(req, { periodId, itemId });
    }
};
exports.PeriodCloseController = PeriodCloseController;
__decorate([
    (0, common_1.Get)('checklist/:periodId'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('periodId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PeriodCloseController.prototype, "getChecklist", null);
__decorate([
    (0, common_1.Post)('checklist/:periodId/items/:itemId/complete'),
    (0, permissions_decorator_1.Permissions)('FINANCE_PERIOD_REVIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('periodId')),
    __param(2, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PeriodCloseController.prototype, "completeItem", null);
exports.PeriodCloseController = PeriodCloseController = __decorate([
    (0, common_1.Controller)('period-close'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [periodClose_service_1.PeriodCloseService])
], PeriodCloseController);
//# sourceMappingURL=periodClose.controller.js.map