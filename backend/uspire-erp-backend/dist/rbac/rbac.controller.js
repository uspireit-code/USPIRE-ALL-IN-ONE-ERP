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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const permissions_decorator_1 = require("./permissions.decorator");
const permissions_guard_1 = require("./permissions.guard");
let RbacController = class RbacController {
    getFinanceGlExample() {
        return { ok: true };
    }
};
exports.RbacController = RbacController;
__decorate([
    (0, common_1.Get)('finance/gl'),
    (0, permissions_decorator_1.Permissions)('FINANCE_GL_VIEW'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RbacController.prototype, "getFinanceGlExample", null);
exports.RbacController = RbacController = __decorate([
    (0, common_1.Controller)('rbac-example'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard)
], RbacController);
//# sourceMappingURL=rbac.controller.js.map