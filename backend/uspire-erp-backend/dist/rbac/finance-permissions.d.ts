export declare const FINANCE_PERMISSIONS: {
    readonly GL: {
        readonly VIEW: "FINANCE_GL_VIEW";
        readonly CREATE: "FINANCE_GL_CREATE";
        readonly POST: "FINANCE_GL_POST";
        readonly FINAL_POST: "FINANCE_GL_FINAL_POST";
        readonly APPROVE: "FINANCE_GL_APPROVE";
        readonly RECURRING_MANAGE: "FINANCE_GL_RECURRING_MANAGE";
        readonly RECURRING_GENERATE: "FINANCE_GL_RECURRING_GENERATE";
    };
    readonly COA: {
        readonly VIEW: "FINANCE_COA_VIEW";
        readonly UPDATE: "FINANCE_COA_UPDATE";
        readonly UNLOCK: "FINANCE_COA_UNLOCK";
        readonly LEGACY_VIEW: "coa.view";
        readonly LEGACY_CREATE: "coa.create";
        readonly LEGACY_UPDATE: "coa.update";
        readonly FREEZE: "coa.freeze";
    };
    readonly AR: {
        readonly CUSTOMER_CREATE: "AR_CUSTOMER_CREATE";
        readonly INVOICE_CREATE: "AR_INVOICE_CREATE";
        readonly INVOICE_SUBMIT: "AR_INVOICE_SUBMIT";
        readonly INVOICE_APPROVE: "AR_INVOICE_APPROVE";
        readonly INVOICE_POST: "AR_INVOICE_POST";
        readonly INVOICE_VIEW: "AR_INVOICE_VIEW";
        readonly RECEIPT_READ: "AR_RECEIPTS_VIEW";
        readonly RECEIPT_CREATE: "AR_RECEIPTS_CREATE";
        readonly RECEIPT_VOID: "AR_RECEIPT_VOID";
        readonly CREDIT_NOTE_CREATE: "AR_CREDIT_NOTE_CREATE";
        readonly CREDIT_NOTE_VIEW: "AR_CREDIT_NOTE_VIEW";
        readonly CREDIT_NOTE_APPROVE: "AR_CREDIT_NOTE_APPROVE";
        readonly CREDIT_NOTE_POST: "AR_CREDIT_NOTE_POST";
        readonly CREDIT_NOTE_VOID: "AR_CREDIT_NOTE_VOID";
        readonly REFUND_VIEW: "AR_REFUND_VIEW";
        readonly REFUND_CREATE: "AR_REFUND_CREATE";
        readonly REFUND_APPROVE: "AR_REFUND_APPROVE";
        readonly REFUND_POST: "AR_REFUND_POST";
        readonly REFUND_VOID: "AR_REFUND_VOID";
    };
    readonly CUSTOMERS: {
        readonly VIEW: "CUSTOMERS_VIEW";
        readonly CREATE: "CUSTOMERS_CREATE";
        readonly EDIT: "CUSTOMERS_EDIT";
        readonly IMPORT: "CUSTOMERS_IMPORT";
    };
    readonly AP: {
        readonly SUPPLIER_CREATE: "AP_SUPPLIER_CREATE";
        readonly INVOICE_CREATE: "AP_INVOICE_CREATE";
        readonly INVOICE_SUBMIT: "AP_INVOICE_SUBMIT";
        readonly INVOICE_APPROVE: "AP_INVOICE_APPROVE";
        readonly INVOICE_POST: "AP_INVOICE_POST";
        readonly INVOICE_VIEW: "AP_INVOICE_VIEW";
    };
    readonly BANK: {
        readonly ACCOUNT_CREATE: "BANK_ACCOUNT_CREATE";
        readonly STATEMENT_IMPORT: "BANK_STATEMENT_IMPORT";
        readonly RECONCILE: "BANK_RECONCILE";
        readonly RECONCILIATION_VIEW: "BANK_RECONCILIATION_VIEW";
    };
    readonly PAYMENT: {
        readonly CREATE: "PAYMENT_CREATE";
        readonly APPROVE: "PAYMENT_APPROVE";
        readonly POST: "PAYMENT_POST";
        readonly VIEW: "PAYMENT_VIEW";
    };
    readonly BUDGET: {
        readonly FINANCE_VIEW: "FINANCE_BUDGET_VIEW";
        readonly CREATE: "BUDGET_CREATE";
        readonly APPROVE: "BUDGET_APPROVE";
        readonly VIEW: "BUDGET_VIEW";
        readonly VS_ACTUAL_VIEW: "BUDGET_VS_ACTUAL_VIEW";
    };
    readonly FA: {
        readonly CATEGORY_MANAGE: "FA_CATEGORY_MANAGE";
        readonly ASSET_CREATE: "FA_ASSET_CREATE";
        readonly ASSET_CAPITALIZE: "FA_ASSET_CAPITALIZE";
        readonly DEPRECIATION_RUN: "FA_DEPRECIATION_RUN";
        readonly DISPOSE: "FA_DISPOSE";
    };
    readonly TAX: {
        readonly RATE_CREATE: "TAX_RATE_CREATE";
        readonly RATE_VIEW: "TAX_RATE_VIEW";
        readonly REPORT_VIEW: "TAX_REPORT_VIEW";
    };
    readonly PERIOD: {
        readonly CREATE: "FINANCE_PERIOD_CREATE";
        readonly VIEW: "FINANCE_PERIOD_VIEW";
        readonly REVIEW: "FINANCE_PERIOD_REVIEW";
        readonly CHECKLIST_VIEW: "FINANCE_PERIOD_CHECKLIST_VIEW";
        readonly CHECKLIST_COMPLETE: "FINANCE_PERIOD_CHECKLIST_COMPLETE";
        readonly CLOSE: "FINANCE_PERIOD_CLOSE";
        readonly CLOSE_APPROVE: "FINANCE_PERIOD_CLOSE_APPROVE";
        readonly REOPEN: "FINANCE_PERIOD_REOPEN";
    };
    readonly REPORT: {
        readonly TB_VIEW: "FINANCE_TB_VIEW";
        readonly PL_VIEW_LEGACY: "FINANCE_PL_VIEW";
        readonly BS_VIEW_LEGACY: "FINANCE_BS_VIEW";
        readonly PNL_VIEW: "FINANCE_PNL_VIEW";
        readonly BALANCE_SHEET_VIEW: "FINANCE_BALANCE_SHEET_VIEW";
        readonly SOCE_VIEW: "FINANCE_SOCE_VIEW";
        readonly CASH_FLOW_VIEW: "FINANCE_CASH_FLOW_VIEW";
        readonly SOE_VIEW: "FINANCE_SOE_VIEW";
        readonly CASHFLOW_VIEW: "FINANCE_CASHFLOW_VIEW";
        readonly AP_AGING_VIEW: "FINANCE_AP_AGING_VIEW";
        readonly AR_AGING_VIEW: "FINANCE_AR_AGING_VIEW";
        readonly SUPPLIER_STATEMENT_VIEW: "FINANCE_SUPPLIER_STATEMENT_VIEW";
        readonly CUSTOMER_STATEMENT_VIEW: "FINANCE_CUSTOMER_STATEMENT_VIEW";
        readonly PRESENTATION_PL_VIEW: "report.view.pl";
        readonly PRESENTATION_BS_VIEW: "report.view.bs";
        readonly PRESENTATION_SOCE_VIEW: "report.view.soce";
        readonly PRESENTATION_CF_VIEW: "report.view.cf";
        readonly EXPORT: "report.export";
        readonly REPORT_GENERATE: "FINANCE_REPORT_GENERATE";
        readonly REPORT_EXPORT: "FINANCE_REPORT_EXPORT";
        readonly DISCLOSURE_GENERATE: "FINANCE_DISCLOSURE_GENERATE";
        readonly DISCLOSURE_VIEW: "FINANCE_DISCLOSURE_VIEW";
    };
};
type FinancePermissionModuleKey = keyof typeof FINANCE_PERMISSIONS;
type FinancePermissionValueUnion = {
    [K in FinancePermissionModuleKey]: (typeof FINANCE_PERMISSIONS)[K][keyof (typeof FINANCE_PERMISSIONS)[K]];
}[FinancePermissionModuleKey];
export type FinancePermissionCode = FinancePermissionValueUnion | string;
export {};
