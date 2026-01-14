export declare const PERMISSIONS: {
    readonly GL: {
        readonly VIEW: "FINANCE_GL_VIEW";
        readonly CREATE: "FINANCE_GL_CREATE";
        readonly POST: "FINANCE_GL_POST";
        readonly FINAL_POST: "FINANCE_GL_FINAL_POST";
        readonly APPROVE: "FINANCE_GL_APPROVE";
        readonly RECURRING_MANAGE: "FINANCE_GL_RECURRING_MANAGE";
        readonly RECURRING_GENERATE: "FINANCE_GL_RECURRING_GENERATE";
        readonly JOURNAL_VIEW_LEGACY: "gl.journal.view";
        readonly JOURNAL_CREATE_LEGACY: "gl.journal.create";
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
        readonly INVOICE_VIEW: "INVOICE_VIEW";
        readonly INVOICE_CREATE: "INVOICE_CREATE";
        readonly INVOICE_EDIT_DRAFT: "AR_INVOICE_EDIT_DRAFT";
        readonly INVOICE_POST: "INVOICE_POST";
        readonly INVOICE_CATEGORY_CREATE: "INVOICE_CATEGORY_CREATE";
        readonly INVOICE_CATEGORY_VIEW: "INVOICE_CATEGORY_VIEW";
        readonly INVOICE_CATEGORY_UPDATE: "INVOICE_CATEGORY_UPDATE";
        readonly INVOICE_CATEGORY_DISABLE: "INVOICE_CATEGORY_DISABLE";
        readonly INVOICE_CREATE_RBAC: "AR_INVOICE_CREATE";
        readonly INVOICE_SUBMIT_RBAC: "AR_INVOICE_SUBMIT";
        readonly INVOICE_APPROVE_RBAC: "AR_INVOICE_APPROVE";
        readonly INVOICE_POST_RBAC: "AR_INVOICE_POST";
        readonly INVOICE_VIEW_RBAC: "AR_INVOICE_VIEW";
        readonly RECEIPT_VIEW: "RECEIPT_VIEW";
        readonly RECEIPT_CREATE: "RECEIPT_CREATE";
        readonly RECEIPT_POST: "RECEIPT_POST";
        readonly RECEIPT_VOID: "AR_RECEIPT_VOID";
        readonly RECEIPT_VIEW_RBAC: "AR_RECEIPTS_VIEW";
        readonly RECEIPT_CREATE_RBAC: "AR_RECEIPTS_CREATE";
        readonly CREDIT_NOTE_VIEW: "CREDIT_NOTE_VIEW";
        readonly CREDIT_NOTE_CREATE: "CREDIT_NOTE_CREATE";
        readonly CREDIT_NOTE_SUBMIT: "CREDIT_NOTE_SUBMIT";
        readonly CREDIT_NOTE_APPROVE: "CREDIT_NOTE_APPROVE";
        readonly CREDIT_NOTE_POST: "CREDIT_NOTE_POST";
        readonly CREDIT_NOTE_VOID: "CREDIT_NOTE_VOID";
        readonly CREDIT_NOTE_CREATE_RBAC: "AR_CREDIT_NOTE_CREATE";
        readonly CREDIT_NOTE_SUBMIT_RBAC: "AR_CREDIT_NOTE_SUBMIT";
        readonly CREDIT_NOTE_VIEW_RBAC: "AR_CREDIT_NOTE_VIEW";
        readonly CREDIT_NOTE_APPROVE_RBAC: "AR_CREDIT_NOTE_APPROVE";
        readonly CREDIT_NOTE_POST_RBAC: "CREDIT_NOTE_POST";
        readonly CREDIT_NOTE_POST_RBAC_ALT: "AR_CREDIT_NOTE_POST";
        readonly CREDIT_NOTE_VOID_RBAC: "AR_CREDIT_NOTE_VOID";
        readonly REFUND_VIEW: "REFUND_VIEW";
        readonly REFUND_CREATE: "REFUND_CREATE";
        readonly REFUND_SUBMIT: "REFUND_SUBMIT";
        readonly REFUND_APPROVE: "REFUND_APPROVE";
        readonly REFUND_POST: "REFUND_POST";
        readonly REFUND_VOID: "REFUND_VOID";
        readonly REFUND_VIEW_RBAC: "AR_REFUND_VIEW";
        readonly REFUND_CREATE_RBAC: "AR_REFUND_CREATE";
        readonly REFUND_SUBMIT_RBAC: "AR_REFUND_SUBMIT";
        readonly REFUND_APPROVE_RBAC: "AR_REFUND_APPROVE";
        readonly REFUND_POST_RBAC: "REFUND_POST";
        readonly REFUND_POST_RBAC_ALT: "AR_REFUND_POST";
        readonly REFUND_VOID_RBAC: "AR_REFUND_VOID";
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
        readonly RELEASE: "PAYMENT_RELEASE";
        readonly POST: "PAYMENT_POST";
        readonly VIEW: "PAYMENT_VIEW";
    };
    readonly BUDGET: {
        readonly FINANCE_VIEW: "FINANCE_BUDGET_VIEW";
        readonly CREATE: "BUDGET_CREATE";
        readonly APPROVE: "BUDGET_APPROVE";
        readonly VIEW: "BUDGET_VIEW";
        readonly SETUP: "BUDGET_SETUP";
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
        readonly RATE_UPDATE: "TAX_RATE_UPDATE";
        readonly CONFIG_UPDATE: "TAX_CONFIG_UPDATE";
        readonly REPORT_VIEW: "TAX_REPORT_VIEW";
    };
    readonly PERIOD: {
        readonly CREATE: "FINANCE_PERIOD_CREATE";
        readonly VIEW: "FINANCE_PERIOD_VIEW";
        readonly REVIEW: "FINANCE_PERIOD_REVIEW";
        readonly CHECKLIST_VIEW: "FINANCE_PERIOD_CHECKLIST_VIEW";
        readonly CHECKLIST_COMPLETE: "FINANCE_PERIOD_CHECKLIST_COMPLETE";
        readonly CORRECT: "FINANCE_PERIOD_CORRECT";
        readonly CLOSE: "FINANCE_PERIOD_CLOSE";
        readonly CLOSE_APPROVE: "FINANCE_PERIOD_CLOSE_APPROVE";
        readonly REOPEN: "FINANCE_PERIOD_REOPEN";
    };
    readonly REPORT: {
        readonly TB_VIEW: "FINANCE_TB_VIEW";
        readonly REPORTS_VIEW: "FINANCE_REPORTS_VIEW";
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
    readonly SYSTEM: {
        readonly VIEW_ALL: "SYSTEM_VIEW_ALL";
        readonly SETTINGS_VIEW: "SETTINGS_VIEW";
        readonly CONFIG_VIEW: "SYSTEM_CONFIG_VIEW";
        readonly CONFIG_UPDATE: "SYSTEM_CONFIG_UPDATE";
        readonly CONFIG_CHANGE: "SYSTEM_CONFIG_CHANGE";
    };
    readonly FINANCE: {
        readonly VIEW_ALL: "FINANCE_VIEW_ALL";
        readonly CONFIG_VIEW: "FINANCE_CONFIG_VIEW";
        readonly CONFIG_UPDATE: "FINANCE_CONFIG_UPDATE";
        readonly CONFIG_CHANGE: "FINANCE_CONFIG_CHANGE";
    };
    readonly USER: {
        readonly VIEW: "USER_VIEW";
        readonly CREATE: "USER_CREATE";
        readonly EDIT: "USER_EDIT";
        readonly ASSIGN_ROLE: "USER_ASSIGN_ROLE";
    };
    readonly ROLE: {
        readonly VIEW: "ROLE_VIEW";
        readonly ASSIGN: "ROLE_ASSIGN";
    };
    readonly AUDIT: {
        readonly EVIDENCE_UPLOAD: "AUDIT_EVIDENCE_UPLOAD";
        readonly EVIDENCE_VIEW: "AUDIT_EVIDENCE_VIEW";
        readonly REVIEW_PACK_GENERATE: "AUDIT_REVIEW_PACK_GENERATE";
        readonly REVIEW_PACK_VIEW: "AUDIT_REVIEW_PACK_VIEW";
    };
    readonly DASHBOARD: {
        readonly VIEW: "dashboard.view";
    };
    readonly FORECAST: {
        readonly CREATE: "forecast.create";
        readonly VIEW: "forecast.view";
        readonly SUBMIT: "forecast.submit";
        readonly APPROVE: "forecast.approve";
        readonly EDIT: "forecast.edit";
    };
    readonly AR_REMINDER: {
        readonly VIEW: "AR_REMINDER_VIEW";
        readonly CONFIGURE: "AR_REMINDER_CONFIGURE";
        readonly TRIGGER: "AR_REMINDER_TRIGGER";
    };
    readonly AR_AGING: {
        readonly VIEW: "AR_AGING_VIEW";
    };
    readonly AR_STATEMENT: {
        readonly VIEW: "AR_STATEMENT_VIEW";
    };
    readonly HR: {
        readonly PAYROLL_VIEW: "HR_PAYROLL_VIEW";
        readonly PAYROLL_RUN: "HR_PAYROLL_RUN";
    };
    readonly CRM: {
        readonly LEADS_VIEW: "CRM_LEADS_VIEW";
        readonly LEADS_EDIT: "CRM_LEADS_EDIT";
    };
    readonly MASTER_DATA: {
        readonly DEPARTMENT: {
            readonly VIEW: "MASTER_DATA_DEPARTMENT_VIEW";
            readonly CREATE: "MASTER_DATA_DEPARTMENT_CREATE";
            readonly EDIT: "MASTER_DATA_DEPARTMENT_EDIT";
        };
        readonly PROJECT: {
            readonly VIEW: "MASTER_DATA_PROJECT_VIEW";
            readonly CREATE: "MASTER_DATA_PROJECT_CREATE";
            readonly EDIT: "MASTER_DATA_PROJECT_EDIT";
            readonly CLOSE: "MASTER_DATA_PROJECT_CLOSE";
        };
        readonly FUND: {
            readonly VIEW: "MASTER_DATA_FUND_VIEW";
            readonly CREATE: "MASTER_DATA_FUND_CREATE";
            readonly EDIT: "MASTER_DATA_FUND_EDIT";
        };
    };
    readonly AUDIT_VIEW: "AUDIT_VIEW";
};
type DeepValue<T> = T extends string ? T : T extends Record<string, unknown> ? {
    [K in keyof T]: DeepValue<T[K]>;
}[keyof T] : never;
export type PermissionCode = DeepValue<typeof PERMISSIONS>;
export type PermissionCodeLoose = PermissionCode | string;
export {};
