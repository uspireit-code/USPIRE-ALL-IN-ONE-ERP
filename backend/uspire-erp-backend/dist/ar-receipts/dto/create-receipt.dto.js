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
exports.CreateReceiptDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const receipt_line_dto_1 = require("./receipt-line.dto");
const PAYMENT_METHODS = ['CASH', 'CARD', 'EFT', 'CHEQUE', 'OTHER'];
class CreateReceiptDto {
    customerId;
    receiptDate;
    currency;
    exchangeRate;
    totalAmount;
    paymentMethod;
    paymentReference;
    reference;
    lines;
}
exports.CreateReceiptDto = CreateReceiptDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReceiptDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateReceiptDto.prototype, "receiptDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReceiptDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Min)(0.000001),
    __metadata("design:type", Number)
], CreateReceiptDto.prototype, "exchangeRate", void 0);
__decorate([
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], CreateReceiptDto.prototype, "totalAmount", void 0);
__decorate([
    (0, class_validator_1.IsIn)(PAYMENT_METHODS),
    __metadata("design:type", Object)
], CreateReceiptDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReceiptDto.prototype, "paymentReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReceiptDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => receipt_line_dto_1.ReceiptLineDto),
    __metadata("design:type", Array)
], CreateReceiptDto.prototype, "lines", void 0);
//# sourceMappingURL=create-receipt.dto.js.map