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
exports.CreateFixedAssetCategoryDto = exports.DepreciationMethodDto = void 0;
const class_validator_1 = require("class-validator");
var DepreciationMethodDto;
(function (DepreciationMethodDto) {
    DepreciationMethodDto["STRAIGHT_LINE"] = "STRAIGHT_LINE";
})(DepreciationMethodDto || (exports.DepreciationMethodDto = DepreciationMethodDto = {}));
class CreateFixedAssetCategoryDto {
    code;
    name;
    defaultMethod;
    defaultUsefulLifeMonths;
    defaultResidualRate;
    assetAccountId;
    accumDepAccountId;
    depExpenseAccountId;
}
exports.CreateFixedAssetCategoryDto = CreateFixedAssetCategoryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(DepreciationMethodDto),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "defaultMethod", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateFixedAssetCategoryDto.prototype, "defaultUsefulLifeMonths", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "defaultResidualRate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "assetAccountId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "accumDepAccountId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetCategoryDto.prototype, "depExpenseAccountId", void 0);
//# sourceMappingURL=create-fa-category.dto.js.map