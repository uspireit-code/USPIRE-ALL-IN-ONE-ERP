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
exports.CreateSupplierInvoiceDto = exports.CreateSupplierInvoiceLineDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const invoice_tax_line_dto_1 = require("./invoice-tax-line.dto");
class CreateSupplierInvoiceLineDto {
    accountId;
    description;
    amount;
}
exports.CreateSupplierInvoiceLineDto = CreateSupplierInvoiceLineDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceLineDto.prototype, "accountId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceLineDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateSupplierInvoiceLineDto.prototype, "amount", void 0);
class CreateSupplierInvoiceDto {
    supplierId;
    invoiceNumber;
    invoiceDate;
    dueDate;
    totalAmount;
    lines;
    taxLines;
    apControlAccountCode;
}
exports.CreateSupplierInvoiceDto = CreateSupplierInvoiceDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceDto.prototype, "supplierId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceDto.prototype, "invoiceNumber", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceDto.prototype, "invoiceDate", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceDto.prototype, "dueDate", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateSupplierInvoiceDto.prototype, "totalAmount", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateSupplierInvoiceLineDto),
    __metadata("design:type", Array)
], CreateSupplierInvoiceDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => invoice_tax_line_dto_1.InvoiceTaxLineDto),
    __metadata("design:type", Array)
], CreateSupplierInvoiceDto.prototype, "taxLines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSupplierInvoiceDto.prototype, "apControlAccountCode", void 0);
//# sourceMappingURL=create-supplier-invoice.dto.js.map