declare const ENTITY_TYPES: readonly ["JOURNAL_ENTRY", "ACCOUNTING_PERIOD", "ACCOUNTING_PERIOD_CHECKLIST_ITEM", "SUPPLIER_INVOICE", "CUSTOMER_INVOICE", "FIXED_ASSET", "FIXED_ASSET_DEPRECIATION_RUN", "BANK_RECONCILIATION_MATCH", "USER"];
declare const EVENT_TYPES: readonly ["JOURNAL_POST", "PERIOD_CHECKLIST_COMPLETE", "PERIOD_CLOSE", "SOD_VIOLATION", "AP_POST", "AR_POST", "FA_CAPITALIZE", "FA_DEPRECIATION_RUN", "FA_DISPOSE", "BANK_RECONCILIATION_MATCH"];
export declare class AuditEventsQueryDto {
    from?: string;
    to?: string;
    entityType?: (typeof ENTITY_TYPES)[number];
    entityId?: string;
    userId?: string;
    eventType?: (typeof EVENT_TYPES)[number];
    offset?: number;
    limit?: number;
}
export {};
