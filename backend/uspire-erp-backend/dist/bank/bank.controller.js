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
exports.BankController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const bank_service_1 = require("./bank.service");
const add_bank_statement_lines_dto_1 = require("./dto/add-bank-statement-lines.dto");
const create_bank_account_dto_1 = require("./dto/create-bank-account.dto");
const create_bank_statement_dto_1 = require("./dto/create-bank-statement.dto");
const list_bank_statements_query_dto_1 = require("./dto/list-bank-statements-query.dto");
const match_bank_reconciliation_dto_1 = require("./dto/match-bank-reconciliation.dto");
const reconciliation_status_query_dto_1 = require("./dto/reconciliation-status-query.dto");
let BankController = class BankController {
    bank;
    constructor(bank) {
        this.bank = bank;
    }
    async createBankAccount(req, dto) {
        return this.bank.createBankAccount(req, dto);
    }
    async listBankAccounts(req) {
        return this.bank.listBankAccounts(req);
    }
    async createStatement(req, dto) {
        return this.bank.createStatement(req, dto);
    }
    async listStatements(req, dto) {
        return this.bank.listStatements(req, dto);
    }
    async getStatement(req, id) {
        return this.bank.getStatement(req, id);
    }
    async addStatementLines(req, id, dto) {
        return this.bank.addStatementLines(req, id, dto);
    }
    async unmatched(req) {
        return this.bank.unmatched(req);
    }
    async match(req, dto) {
        return this.bank.match(req, dto);
    }
    async status(req, dto) {
        return this.bank.status(req, dto);
    }
};
exports.BankController = BankController;
__decorate([
    (0, common_1.Post)('accounts'),
    (0, permissions_decorator_1.Permissions)('BANK_ACCOUNT_CREATE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_bank_account_dto_1.CreateBankAccountDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "createBankAccount", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILIATION_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "listBankAccounts", null);
__decorate([
    (0, common_1.Post)('statements'),
    (0, permissions_decorator_1.Permissions)('BANK_STATEMENT_IMPORT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_bank_statement_dto_1.CreateBankStatementDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "createStatement", null);
__decorate([
    (0, common_1.Get)('statements'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILIATION_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_bank_statements_query_dto_1.ListBankStatementsQueryDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "listStatements", null);
__decorate([
    (0, common_1.Get)('statements/:id'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILIATION_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "getStatement", null);
__decorate([
    (0, common_1.Post)('statements/:id/lines'),
    (0, permissions_decorator_1.Permissions)('BANK_STATEMENT_IMPORT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_bank_statement_lines_dto_1.AddBankStatementLinesDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "addStatementLines", null);
__decorate([
    (0, common_1.Get)('reconciliation/unmatched'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILIATION_VIEW'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "unmatched", null);
__decorate([
    (0, common_1.Post)('reconciliation/match'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILE'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, match_bank_reconciliation_dto_1.MatchBankReconciliationDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "match", null);
__decorate([
    (0, common_1.Get)('reconciliation/status'),
    (0, permissions_decorator_1.Permissions)('BANK_RECONCILIATION_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reconciliation_status_query_dto_1.ReconciliationStatusQueryDto]),
    __metadata("design:returntype", Promise)
], BankController.prototype, "status", null);
exports.BankController = BankController = __decorate([
    (0, common_1.Controller)('bank'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [bank_service_1.BankService])
], BankController);
//# sourceMappingURL=bank.controller.js.map