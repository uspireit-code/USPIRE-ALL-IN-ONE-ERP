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
exports.CreateRecurringTemplateDto = exports.CreateRecurringTemplateLineDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateRecurringTemplateLineDto {
    accountId;
    descriptionTemplate;
    debitAmount;
    creditAmount;
    lineOrder;
}
exports.CreateRecurringTemplateLineDto = CreateRecurringTemplateLineDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateRecurringTemplateLineDto.prototype, "accountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateLineDto.prototype, "descriptionTemplate", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRecurringTemplateLineDto.prototype, "debitAmount", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateRecurringTemplateLineDto.prototype, "creditAmount", void 0);
__decorate([
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateRecurringTemplateLineDto.prototype, "lineOrder", void 0);
class CreateRecurringTemplateDto {
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
exports.CreateRecurringTemplateDto = CreateRecurringTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['STANDARD']),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "journalType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "referenceTemplate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "descriptionTemplate", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['MONTHLY', 'QUARTERLY', 'YEARLY']),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "frequency", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRecurringTemplateDto.prototype, "nextRunDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRecurringTemplateDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateRecurringTemplateLineDto),
    __metadata("design:type", Array)
], CreateRecurringTemplateDto.prototype, "lines", void 0);
//# sourceMappingURL=create-recurring-template.dto.js.map