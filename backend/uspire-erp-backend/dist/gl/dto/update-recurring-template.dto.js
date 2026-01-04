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
exports.UpdateRecurringTemplateDto = exports.UpdateRecurringTemplateLineDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class UpdateRecurringTemplateLineDto {
    accountId;
    descriptionTemplate;
    debitAmount;
    creditAmount;
    lineOrder;
}
exports.UpdateRecurringTemplateLineDto = UpdateRecurringTemplateLineDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateLineDto.prototype, "accountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateLineDto.prototype, "descriptionTemplate", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRecurringTemplateLineDto.prototype, "debitAmount", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateRecurringTemplateLineDto.prototype, "creditAmount", void 0);
__decorate([
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateRecurringTemplateLineDto.prototype, "lineOrder", void 0);
class UpdateRecurringTemplateDto {
    name;
    journalType;
    referenceTemplate;
    descriptionTemplate;
    frequency;
    startDate;
    endDate;
    nextRunDate;
    isActive;
    lines;
}
exports.UpdateRecurringTemplateDto = UpdateRecurringTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['STANDARD']),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "journalType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "referenceTemplate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "descriptionTemplate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['MONTHLY', 'QUARTERLY', 'YEARLY']),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "frequency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], UpdateRecurringTemplateDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateRecurringTemplateDto.prototype, "nextRunDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRecurringTemplateDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpdateRecurringTemplateLineDto),
    __metadata("design:type", Array)
], UpdateRecurringTemplateDto.prototype, "lines", void 0);
//# sourceMappingURL=update-recurring-template.dto.js.map