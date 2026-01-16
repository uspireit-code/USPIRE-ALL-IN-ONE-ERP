declare const ENTITY_TYPES: readonly ["JOURNAL_ENTRY", "ACCOUNTING_PERIOD", "ACCOUNTING_PERIOD_CHECKLIST_ITEM", "SUPPLIER_INVOICE", "CUSTOMER_INVOICE", "FIXED_ASSET", "FIXED_ASSET_DEPRECIATION_RUN", "BANK_RECONCILIATION_MATCH", "USER"];
export declare class AuditEvidenceQueryDto {
    entityType?: (typeof ENTITY_TYPES)[number];
    entityId?: string;
}
export {};
