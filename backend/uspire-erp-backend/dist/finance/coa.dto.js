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
exports.UpdateCoaAccountDto = exports.CreateCoaAccountDto = exports.BudgetControlModeDto = exports.NormalBalanceDto = exports.CoaAccountTypeDto = void 0;
const class_validator_1 = require("class-validator");
var CoaAccountTypeDto;
(function (CoaAccountTypeDto) {
    CoaAccountTypeDto["ASSET"] = "ASSET";
    CoaAccountTypeDto["LIABILITY"] = "LIABILITY";
    CoaAccountTypeDto["EQUITY"] = "EQUITY";
    CoaAccountTypeDto["INCOME"] = "INCOME";
    CoaAccountTypeDto["EXPENSE"] = "EXPENSE";
})(CoaAccountTypeDto || (exports.CoaAccountTypeDto = CoaAccountTypeDto = {}));
var NormalBalanceDto;
(function (NormalBalanceDto) {
    NormalBalanceDto["DEBIT"] = "DEBIT";
    NormalBalanceDto["CREDIT"] = "CREDIT";
})(NormalBalanceDto || (exports.NormalBalanceDto = NormalBalanceDto = {}));
var BudgetControlModeDto;
(function (BudgetControlModeDto) {
    BudgetControlModeDto["WARN"] = "WARN";
    BudgetControlModeDto["BLOCK"] = "BLOCK";
})(BudgetControlModeDto || (exports.BudgetControlModeDto = BudgetControlModeDto = {}));
class CreateCoaAccountDto {
    code;
    name;
    accountType;
    parentAccountId;
    isPosting;
    isPostingAllowed;
    isControlAccount;
    normalBalance;
    isActive;
    subCategory;
    fsMappingLevel1;
    fsMappingLevel2;
    isBudgetRelevant;
    budgetControlMode;
}
exports.CreateCoaAccountDto = CreateCoaAccountDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(CoaAccountTypeDto),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "accountType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateCoaAccountDto.prototype, "parentAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCoaAccountDto.prototype, "isPosting", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCoaAccountDto.prototype, "isPostingAllowed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCoaAccountDto.prototype, "isControlAccount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(NormalBalanceDto),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "normalBalance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCoaAccountDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "subCategory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "fsMappingLevel1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "fsMappingLevel2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateCoaAccountDto.prototype, "isBudgetRelevant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(BudgetControlModeDto),
    __metadata("design:type", String)
], CreateCoaAccountDto.prototype, "budgetControlMode", void 0);
class UpdateCoaAccountDto {
    code;
    name;
    accountType;
    parentAccountId;
    isPosting;
    isPostingAllowed;
    isControlAccount;
    normalBalance;
    isActive;
    subCategory;
    fsMappingLevel1;
    fsMappingLevel2;
    ifrsMappingCode;
    isBudgetRelevant;
    budgetControlMode;
}
exports.UpdateCoaAccountDto = UpdateCoaAccountDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(CoaAccountTypeDto),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "accountType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateCoaAccountDto.prototype, "parentAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCoaAccountDto.prototype, "isPosting", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCoaAccountDto.prototype, "isPostingAllowed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCoaAccountDto.prototype, "isControlAccount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(NormalBalanceDto),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "normalBalance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCoaAccountDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "subCategory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "fsMappingLevel1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "fsMappingLevel2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "ifrsMappingCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCoaAccountDto.prototype, "isBudgetRelevant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(BudgetControlModeDto),
    __metadata("design:type", String)
], UpdateCoaAccountDto.prototype, "budgetControlMode", void 0);
//# sourceMappingURL=coa.dto.js.map