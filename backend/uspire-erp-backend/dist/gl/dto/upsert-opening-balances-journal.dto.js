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
exports.UpsertOpeningBalancesJournalDto = exports.UpsertOpeningBalancesJournalLineDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class UpsertOpeningBalancesJournalLineDto {
    accountId;
    debit;
    credit;
}
exports.UpsertOpeningBalancesJournalLineDto = UpsertOpeningBalancesJournalLineDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertOpeningBalancesJournalLineDto.prototype, "accountId", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertOpeningBalancesJournalLineDto.prototype, "debit", void 0);
__decorate([
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertOpeningBalancesJournalLineDto.prototype, "credit", void 0);
class UpsertOpeningBalancesJournalDto {
    cutoverDate;
    lines;
}
exports.UpsertOpeningBalancesJournalDto = UpsertOpeningBalancesJournalDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpsertOpeningBalancesJournalDto.prototype, "cutoverDate", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertOpeningBalancesJournalLineDto),
    __metadata("design:type", Array)
], UpsertOpeningBalancesJournalDto.prototype, "lines", void 0);
//# sourceMappingURL=upsert-opening-balances-journal.dto.js.map