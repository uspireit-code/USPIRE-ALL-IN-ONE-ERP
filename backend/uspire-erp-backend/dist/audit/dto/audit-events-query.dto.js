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
exports.AuditEventsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const ENTITY_TYPES = [
    'JOURNAL_ENTRY',
    'ACCOUNTING_PERIOD',
    'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
    'SUPPLIER_INVOICE',
    'CUSTOMER_INVOICE',
    'FIXED_ASSET',
    'FIXED_ASSET_DEPRECIATION_RUN',
    'BANK_RECONCILIATION_MATCH',
    'USER',
];
const EVENT_TYPES = [
    'JOURNAL_POST',
    'PERIOD_CHECKLIST_COMPLETE',
    'PERIOD_CLOSE',
    'SOD_VIOLATION',
    'AP_POST',
    'AR_POST',
    'FA_CAPITALIZE',
    'FA_DEPRECIATION_RUN',
    'FA_DISPOSE',
    'BANK_RECONCILIATION_MATCH',
];
class AuditEventsQueryDto {
    from;
    to;
    entityType;
    entityId;
    userId;
    eventType;
    offset;
    limit;
}
exports.AuditEventsQueryDto = AuditEventsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditEventsQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AuditEventsQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(ENTITY_TYPES),
    __metadata("design:type", Object)
], AuditEventsQueryDto.prototype, "entityType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuditEventsQueryDto.prototype, "entityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AuditEventsQueryDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(EVENT_TYPES),
    __metadata("design:type", Object)
], AuditEventsQueryDto.prototype, "eventType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AuditEventsQueryDto.prototype, "offset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], AuditEventsQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=audit-events-query.dto.js.map