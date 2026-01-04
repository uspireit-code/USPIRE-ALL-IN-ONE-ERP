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
exports.CreateFixedAssetDto = exports.DepreciationMethodDto = void 0;
const class_validator_1 = require("class-validator");
var DepreciationMethodDto;
(function (DepreciationMethodDto) {
    DepreciationMethodDto["STRAIGHT_LINE"] = "STRAIGHT_LINE";
})(DepreciationMethodDto || (exports.DepreciationMethodDto = DepreciationMethodDto = {}));
class CreateFixedAssetDto {
    categoryId;
    name;
    description;
    acquisitionDate;
    cost;
    residualValue;
    usefulLifeMonths;
    method;
    vendorId;
    apInvoiceId;
}
exports.CreateFixedAssetDto = CreateFixedAssetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "acquisitionDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "cost", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "residualValue", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateFixedAssetDto.prototype, "usefulLifeMonths", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(DepreciationMethodDto),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "vendorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFixedAssetDto.prototype, "apInvoiceId", void 0);
//# sourceMappingURL=create-fa-asset.dto.js.map