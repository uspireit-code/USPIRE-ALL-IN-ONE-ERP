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
exports.BudgetsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const budgets_service_1 = require("./budgets.service");
const create_budget_dto_1 = require("./dto/create-budget.dto");
let BudgetsController = class BudgetsController {
    budgets;
    constructor(budgets) {
        this.budgets = budgets;
    }
    async createBudget(req, dto) {
        return this.budgets.createBudget(req, dto);
    }
    async approveBudget(req, id) {
        return this.budgets.approveBudget(req, id);
    }
    async listBudgets(req, fiscalYear) {
        const fy = fiscalYear ? Number(fiscalYear) : undefined;
        return this.budgets.listBudgets(req, {
            fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
        });
    }
    async budgetVsActualPaged(req, fiscalYear, periodId, accountId, limit, offset, sortBy, sortDir) {
        const fy = fiscalYear ? Number(fiscalYear) : undefined;
        const lim = limit ? Number(limit) : undefined;
        const off = offset ? Number(offset) : undefined;
        return this.budgets.budgetVsActualPaged(req, {
            fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
            periodId: periodId?.trim() || undefined,
            accountId: accountId?.trim() || undefined,
            limit: lim && Number.isFinite(lim) ? lim : undefined,
            offset: off && Number.isFinite(off) ? off : undefined,
            sortBy: sortBy?.trim() || undefined,
            sortDir: sortDir?.trim() || undefined,
        });
    }
    async budgetVsActualDrilldownJournals(req, accountId, periodId, limit, offset) {
        const lim = limit ? Number(limit) : undefined;
        const off = offset ? Number(offset) : undefined;
        return this.budgets.budgetVsActualJournals(req, {
            accountId,
            periodId,
            limit: lim && Number.isFinite(lim) ? lim : undefined,
            offset: off && Number.isFinite(off) ? off : undefined,
        });
    }
    async budgetVsActualMatrix(req, fiscalYear) {
        const fy = fiscalYear ? Number(fiscalYear) : undefined;
        return this.budgets.budgetVsActual(req, {
            fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
        });
    }
    async getBudget(req, id) {
        return this.budgets.getBudget(req, id);
    }
};
exports.BudgetsController = BudgetsController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('BUDGET_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_budget_dto_1.CreateBudgetDto]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "createBudget", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, permissions_decorator_1.Permissions)('BUDGET_APPROVE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "approveBudget", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('BUDGET_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('fiscalYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "listBudgets", null);
__decorate([
    (0, common_1.Get)('vs-actual'),
    (0, permissions_decorator_1.Permissions)('FINANCE_BUDGET_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('fiscalYear')),
    __param(2, (0, common_1.Query)('periodId')),
    __param(3, (0, common_1.Query)('accountId')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('offset')),
    __param(6, (0, common_1.Query)('sortBy')),
    __param(7, (0, common_1.Query)('sortDir')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "budgetVsActualPaged", null);
__decorate([
    (0, common_1.Get)('vs-actual/:accountId/:periodId/journals'),
    (0, permissions_decorator_1.Permissions)('FINANCE_BUDGET_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('accountId')),
    __param(2, (0, common_1.Param)('periodId')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "budgetVsActualDrilldownJournals", null);
__decorate([
    (0, common_1.Get)('vs-actual/matrix'),
    (0, permissions_decorator_1.Permissions)('BUDGET_VS_ACTUAL_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('fiscalYear')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "budgetVsActualMatrix", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('BUDGET_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BudgetsController.prototype, "getBudget", null);
exports.BudgetsController = BudgetsController = __decorate([
    (0, common_1.Controller)('budgets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [budgets_service_1.BudgetsService])
], BudgetsController);
//# sourceMappingURL=budgets.controller.js.map