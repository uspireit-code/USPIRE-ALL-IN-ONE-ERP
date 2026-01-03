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
exports.UpdateSystemConfigDto = void 0;
const class_validator_1 = require("class-validator");
function isNotNull(_, value) {
    return value !== null;
}
class UpdateSystemConfigDto {
    organisationName;
    organisationShortName;
    legalName;
    defaultCurrency;
    country;
    timezone;
    financialYearStartMonth;
    dateFormat;
    numberFormat;
    defaultLandingPage;
    defaultDashboard;
    defaultLanguage;
    demoModeEnabled;
    defaultUserRoleCode;
    primaryColor;
    secondaryColor;
    accentColor;
    secondaryAccentColor;
    allowSelfPosting;
    receiptBankName;
    receiptBankAccountName;
    receiptBankAccountNumber;
    receiptBankBranch;
    receiptBankSwiftCode;
    arControlAccountId;
    defaultBankClearingAccountId;
    unappliedReceiptsAccountId;
}
exports.UpdateSystemConfigDto = UpdateSystemConfigDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "organisationName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "organisationShortName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "legalName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultCurrency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "timezone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "financialYearStartMonth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "dateFormat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "numberFormat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultLandingPage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultDashboard", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultLanguage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "demoModeEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultUserRoleCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "primaryColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "secondaryColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "accentColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "secondaryAccentColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "allowSelfPosting", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "receiptBankName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "receiptBankAccountName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "receiptBankAccountNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "receiptBankBranch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "receiptBankSwiftCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "arControlAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "defaultBankClearingAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)(isNotNull),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateSystemConfigDto.prototype, "unappliedReceiptsAccountId", void 0);
//# sourceMappingURL=update-system-config.dto.js.map