import { Prisma, PrismaClient, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSIONS } from '../src/rbac/permission-catalog';

const prisma = new PrismaClient();

async function seedJournalLineDimensionsMasters() {
  const effectiveFrom = new Date('2020-01-01T00:00:00.000Z');

  const tenants = await prisma.tenant.findMany({
    select: { id: true },
  });

  for (const t of tenants) {
    await prisma.legalEntity.upsert({
      where: {
        tenantId_code: {
          tenantId: t.id,
          code: '001',
        },
      },
      create: {
        tenantId: t.id,
        code: '001',
        name: 'USPIRE Limited',
        isActive: true,
        effectiveFrom,
        effectiveTo: null,
      },
      update: {},
    });

    await prisma.department.upsert({
      where: {
        tenantId_code: {
          tenantId: t.id,
          code: 'FIN',
        },
      },
      create: {
        tenantId: t.id,
        code: 'FIN',
        name: 'Finance Department',
        isActive: true,
        effectiveFrom,
        effectiveTo: null,
      },
      update: {},
    });
  }
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { name: 'USPIRE Demo Tenant' },
    create: {
      name: 'USPIRE Demo Tenant',
      organisationName: 'USPIRE Demo Tenant',
      primaryColor: '#020445',
      status: TenantStatus.ACTIVE,
    },
    update: {},
  });

  const arControlAccount = await prisma.account.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: '11000',
      },
    },
    create: {
      tenantId: tenant.id,
      code: '11000',
      name: 'Accounts Receivable Control',
      type: 'ASSET' as any,
      normalBalance: 'DEBIT' as any,
      isActive: true,
      isPosting: true,
      isControlAccount: true,
    } as any,
    update: {
      name: 'Accounts Receivable Control',
      type: 'ASSET' as any,
      normalBalance: 'DEBIT' as any,
      isActive: true,
      isPosting: true,
      isControlAccount: true,
    } as any,
    select: { id: true },
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { arControlAccountId: arControlAccount.id },
  });

  const baselineChecklistItems: Array<{ code: string; label: string }> = [
    { code: 'BANK_RECONCILIATION', label: 'Bank reconciliations completed and reviewed' },
    { code: 'AP_RECONCILIATION', label: 'AP subledger reconciled to GL' },
    { code: 'AR_RECONCILIATION', label: 'AR subledger reconciled to GL' },
    { code: 'GL_REVIEW', label: 'General ledger review completed (journals, accruals, reclasses)' },
    { code: 'REPORTING_PACKAGE', label: 'Financial statements generated and reviewed' },
  ];

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  await prisma['accountingPeriodChecklistItem'].createMany({
    data: periods.flatMap((p) =>
      baselineChecklistItems.map((i) => ({
        tenantId: tenant.id,
        periodId: p.id,
        code: i.code,
        label: i.label,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.entity.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'USPIRE Demo Entity',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'USPIRE Demo Entity',
      jurisdiction: 'ZA',
      baseCurrency: 'ZAR',
      fiscalYearStart: 1,
    },
    update: {},
  });

  const permissions = [
    { code: PERMISSIONS.SYSTEM.VIEW_ALL, description: 'System-wide visibility across all modules' },
    { code: PERMISSIONS.FINANCE.VIEW_ALL, description: 'View all finance modules and screens (visibility only)' },
    { code: PERMISSIONS.SYSTEM.SETTINGS_VIEW, description: 'View system and finance settings' },
    { code: PERMISSIONS.SYSTEM.CONFIG_CHANGE, description: 'Change system configuration (non-finance)' },
    { code: PERMISSIONS.FINANCE.CONFIG_CHANGE, description: 'Change finance configuration (governed)' },

    { code: PERMISSIONS.SYSTEM.CONFIG_VIEW, description: 'View system configuration' },
    { code: PERMISSIONS.SYSTEM.CONFIG_UPDATE, description: 'Update system configuration' },

    { code: PERMISSIONS.USER.CREATE, description: 'Create users' },
    { code: PERMISSIONS.USER.VIEW, description: 'View users' },
    { code: PERMISSIONS.USER.EDIT, description: 'Edit users (status/profile)' },
    { code: PERMISSIONS.USER.ASSIGN_ROLE, description: 'Assign roles to users' },
    { code: PERMISSIONS.ROLE.VIEW, description: 'View roles' },
    { code: PERMISSIONS.ROLE.ASSIGN, description: 'Assign permissions to roles' },

    { code: PERMISSIONS.AR.RECEIPT_POST, description: 'Post receipts' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_POST, description: 'Post credit notes' },
    { code: PERMISSIONS.AR.REFUND_POST, description: 'Post refunds' },

    { code: PERMISSIONS.GL.VIEW, description: 'View General Ledger' },
    { code: PERMISSIONS.GL.CREATE, description: 'Create draft journal entries and accounts' },
    { code: PERMISSIONS.GL.POST, description: 'Post General Ledger entries' },
    { code: PERMISSIONS.GL.FINAL_POST, description: 'Final post General Ledger entries (controller)' },
    { code: PERMISSIONS.GL.APPROVE, description: 'Approve General Ledger postings' },
    { code: PERMISSIONS.GL.RECURRING_MANAGE, description: 'Manage recurring journal templates' },
    { code: PERMISSIONS.GL.RECURRING_GENERATE, description: 'Generate journals from recurring templates' },
    { code: PERMISSIONS.COA.VIEW, description: 'View Chart of Accounts (finance)' },
    { code: PERMISSIONS.COA.UPDATE, description: 'Update Chart of Accounts (finance)' },
    { code: PERMISSIONS.COA.UNLOCK, description: 'Allows unlocking the Chart of Accounts for governed structural changes' },
    { code: PERMISSIONS.COA.LEGACY_VIEW, description: 'View Chart of Accounts' },
    { code: PERMISSIONS.COA.LEGACY_CREATE, description: 'Create Chart of Accounts entries' },
    { code: PERMISSIONS.COA.LEGACY_UPDATE, description: 'Update Chart of Accounts entries' },
    { code: PERMISSIONS.COA.FREEZE, description: 'Freeze / unfreeze the Chart of Accounts' },
    { code: PERMISSIONS.REPORT.REPORTS_VIEW, description: 'Access financial reports module and view financial statements' },
    { code: PERMISSIONS.AUDIT_VIEW, description: 'View audit events' },
    { code: PERMISSIONS.AUDIT.EVIDENCE_UPLOAD, description: 'Upload audit evidence attachments' },
    { code: PERMISSIONS.AUDIT.EVIDENCE_VIEW, description: 'View and download audit evidence attachments' },
    { code: PERMISSIONS.AUDIT.REVIEW_PACK_VIEW, description: 'View management & audit review packs' },
    { code: PERMISSIONS.AUDIT.REVIEW_PACK_GENERATE, description: 'Generate and download management & audit review packs' },
    { code: PERMISSIONS.BUDGET.CREATE, description: 'Create draft budgets and budget revisions' },
    { code: PERMISSIONS.BUDGET.APPROVE, description: 'Approve budgets (activate for fiscal year)' },
    { code: PERMISSIONS.BUDGET.VIEW, description: 'View budgets and budget lines' },
    { code: PERMISSIONS.BUDGET.SETUP, description: 'Access budget setup / maintenance screens' },
    { code: PERMISSIONS.BUDGET.VS_ACTUAL_VIEW, description: 'View budget vs actual reporting' },
    { code: PERMISSIONS.BUDGET.FINANCE_VIEW, description: 'View Finance budgets and Budget vs Actual reporting' },
    { code: PERMISSIONS.DASHBOARD.VIEW, description: 'View management dashboards' },
    { code: PERMISSIONS.FORECAST.CREATE, description: 'Create draft annual forecasts' },
    { code: PERMISSIONS.FORECAST.EDIT, description: 'Edit draft annual forecasts and versions' },
    { code: PERMISSIONS.FORECAST.SUBMIT, description: 'Submit forecasts for approval' },
    { code: PERMISSIONS.FORECAST.APPROVE, description: 'Approve forecasts (maker-checker enforced)' },
    { code: PERMISSIONS.FORECAST.VIEW, description: 'View annual forecasts and versions' },
    { code: PERMISSIONS.FA.CATEGORY_MANAGE, description: 'Manage fixed asset categories' },
    { code: PERMISSIONS.FA.ASSET_CREATE, description: 'Create fixed assets (draft)' },
    { code: PERMISSIONS.FA.ASSET_CAPITALIZE, description: 'Capitalize fixed assets' },
    { code: PERMISSIONS.FA.DEPRECIATION_RUN, description: 'Run fixed asset depreciation' },
    { code: PERMISSIONS.FA.DISPOSE, description: 'Dispose fixed assets' },
    { code: PERMISSIONS.PERIOD.CREATE, description: 'Create accounting periods' },
    { code: PERMISSIONS.PERIOD.VIEW, description: 'View accounting periods' },
    { code: PERMISSIONS.PERIOD.REVIEW, description: 'Review month-end close checklist for accounting periods' },
    { code: PERMISSIONS.PERIOD.CHECKLIST_VIEW, description: 'View month-end close checklist for accounting periods' },
    { code: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE, description: 'Complete month-end close checklist items for accounting periods' },
    { code: PERMISSIONS.PERIOD.CLOSE, description: 'Close accounting periods' },
    { code: PERMISSIONS.PERIOD.CLOSE_APPROVE, description: 'Approve and execute accounting period close' },
    { code: PERMISSIONS.PERIOD.REOPEN, description: 'Re-open (unlock) an accounting period' },
    { code: PERMISSIONS.PERIOD.CORRECT, description: 'Correct accounting period dates (governed)' },
    { code: PERMISSIONS.REPORT.TB_VIEW, description: 'View Trial Balance' },
    { code: PERMISSIONS.REPORT.PL_VIEW_LEGACY, description: 'View Profit & Loss statement' },
    { code: PERMISSIONS.REPORT.BS_VIEW_LEGACY, description: 'View Balance Sheet' },
    { code: PERMISSIONS.REPORT.PNL_VIEW, description: 'View Profit & Loss (engine)' },
    { code: PERMISSIONS.REPORT.BALANCE_SHEET_VIEW, description: 'View Balance Sheet (engine)' },
    { code: PERMISSIONS.REPORT.SOCE_VIEW, description: 'View Statement of Changes in Equity' },
    { code: PERMISSIONS.REPORT.CASH_FLOW_VIEW, description: 'View Cash Flow statement' },
    { code: PERMISSIONS.REPORT.SOE_VIEW, description: 'View Statement of Changes in Equity' },
    { code: PERMISSIONS.REPORT.CASHFLOW_VIEW, description: 'View Cash Flow statement' },
    { code: PERMISSIONS.REPORT.AP_AGING_VIEW, description: 'View Accounts Payable aging report' },
    { code: PERMISSIONS.REPORT.AR_AGING_VIEW, description: 'View Accounts Receivable aging report' },
    { code: PERMISSIONS.REPORT.SUPPLIER_STATEMENT_VIEW, description: 'View supplier statement' },
    { code: PERMISSIONS.REPORT.CUSTOMER_STATEMENT_VIEW, description: 'View customer statement' },
    { code: PERMISSIONS.REPORT.PRESENTATION_PL_VIEW, description: 'View Profit & Loss (presentation)' },
    { code: PERMISSIONS.REPORT.PRESENTATION_BS_VIEW, description: 'View Balance Sheet (presentation)' },
    { code: PERMISSIONS.REPORT.PRESENTATION_SOCE_VIEW, description: 'View Statement of Changes in Equity (presentation)' },
    { code: PERMISSIONS.REPORT.PRESENTATION_CF_VIEW, description: 'View Cash Flow (presentation)' },
    { code: PERMISSIONS.REPORT.EXPORT, description: 'Export financial reports (PDF/CSV/XLSX)' },
    { code: PERMISSIONS.REPORT.REPORT_GENERATE, description: 'Run / generate financial statements (SOCE, Cash Flow, etc.)' },
    { code: PERMISSIONS.REPORT.REPORT_EXPORT, description: 'Export financial statements (PDF/CSV/XLSX)' },
    { code: PERMISSIONS.REPORT.DISCLOSURE_GENERATE, description: 'Generate disclosure notes' },
    { code: PERMISSIONS.REPORT.DISCLOSURE_VIEW, description: 'View disclosure notes' },
    { code: PERMISSIONS.TAX.RATE_CREATE, description: 'Create tax / VAT rates' },
    { code: PERMISSIONS.TAX.RATE_VIEW, description: 'View tax / VAT rates' },
    { code: PERMISSIONS.TAX.RATE_UPDATE, description: 'Update tax / VAT rates' },
    { code: PERMISSIONS.TAX.CONFIG_UPDATE, description: 'Update tax / VAT configuration' },
    { code: PERMISSIONS.TAX.REPORT_VIEW, description: 'View VAT reports' },
    { code: PERMISSIONS.AP.SUPPLIER_CREATE, description: 'Create suppliers' },
    { code: PERMISSIONS.AP.SUPPLIER_VIEW, description: 'View suppliers' },
    { code: PERMISSIONS.AP.SUPPLIER_IMPORT, description: 'Import suppliers in bulk' },
    { code: PERMISSIONS.AP.INVOICE_CREATE, description: 'Create supplier invoices' },
    { code: PERMISSIONS.AP.INVOICE_SUBMIT, description: 'Submit supplier invoices' },
    { code: PERMISSIONS.AP.INVOICE_APPROVE, description: 'Approve supplier invoices' },
    { code: PERMISSIONS.AP.INVOICE_POST, description: 'Post supplier invoices to GL' },
    { code: PERMISSIONS.AP.INVOICE_VIEW, description: 'View supplier invoices' },
    { code: PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW, description: 'View system settings' },
    { code: PERMISSIONS.AR.CUSTOMER_CREATE, description: 'Create customers' },
    { code: PERMISSIONS.AR.INVOICE_CREATE_RBAC, description: 'Create customer invoices' },
    { code: PERMISSIONS.AR.INVOICE_CREATE, description: 'Create customer invoices (alias)' },
    { code: PERMISSIONS.AR.INVOICE_EDIT_DRAFT, description: 'Edit draft customer invoices' },
    { code: PERMISSIONS.AR.INVOICE_SUBMIT_RBAC, description: 'Submit customer invoices' },
    { code: PERMISSIONS.AR.INVOICE_APPROVE_RBAC, description: 'Approve customer invoices' },
    { code: PERMISSIONS.AR.INVOICE_POST_RBAC, description: 'Post customer invoices to GL' },
    { code: PERMISSIONS.AR.INVOICE_POST, description: 'Post customer invoices to GL (governed)' },
    { code: PERMISSIONS.AR.INVOICE_VIEW_RBAC, description: 'View customer invoices' },
    { code: PERMISSIONS.AR.INVOICE_VIEW, description: 'View customer invoices (alias)' },
    { code: PERMISSIONS.AR.RECEIPT_VIEW_RBAC, description: 'View customer receipts' },
    { code: PERMISSIONS.AR.RECEIPT_CREATE_RBAC, description: 'Create customer receipts' },
    { code: PERMISSIONS.AR.RECEIPT_CREATE, description: 'Create customer receipts (alias)' },
    { code: PERMISSIONS.AR.RECEIPT_VOID, description: 'Void customer receipts' },
    { code: PERMISSIONS.AR.RECEIPT_VIEW, description: 'View customer receipts (alias)' },

    { code: PERMISSIONS.AR_AGING.VIEW, description: 'View Accounts Receivable aging report' },

    { code: PERMISSIONS.AR_STATEMENT.VIEW, description: 'View customer statements (Accounts Receivable)' },

    { code: PERMISSIONS.AR_REMINDER.VIEW, description: 'View Accounts Receivable reminder rules, templates, and logs' },
    { code: PERMISSIONS.AR_REMINDER.CONFIGURE, description: 'Configure Accounts Receivable reminder rules and templates' },
    { code: PERMISSIONS.AR_REMINDER.TRIGGER, description: 'Trigger Accounts Receivable reminders manually' },
    { code: PERMISSIONS.CUSTOMERS.VIEW, description: 'View customer master data' },
    { code: PERMISSIONS.CUSTOMERS.CREATE, description: 'Create customers (master)' },
    { code: PERMISSIONS.CUSTOMERS.EDIT, description: 'Edit customers (master)' },
    { code: PERMISSIONS.CUSTOMERS.IMPORT, description: 'Import customers in bulk' },
    { code: PERMISSIONS.BANK.ACCOUNT_CREATE, description: 'Create bank accounts' },
    { code: PERMISSIONS.PAYMENT.CREATE, description: 'Create payments' },
    { code: PERMISSIONS.PAYMENT.APPROVE, description: 'Approve payments' },
    { code: PERMISSIONS.PAYMENT.RELEASE, description: 'Release payments' },
    { code: PERMISSIONS.PAYMENT.POST, description: 'Post payments to GL' },
    { code: PERMISSIONS.PAYMENT.VIEW, description: 'View payments' },

    { code: PERMISSIONS.GL.JOURNAL_VIEW_LEGACY, description: 'View GL journals (legacy)' },
    { code: PERMISSIONS.GL.JOURNAL_CREATE_LEGACY, description: 'Create GL journals (legacy)' },
    { code: PERMISSIONS.BANK.STATEMENT_IMPORT, description: 'Import / record bank statements' },
    { code: PERMISSIONS.BANK.RECONCILE, description: 'Reconcile bank statement lines to posted payments' },
    { code: PERMISSIONS.BANK.RECONCILIATION_VIEW, description: 'View bank reconciliation status and unmatched items' },
    { code: PERMISSIONS.HR.PAYROLL_VIEW, description: 'View Payroll' },
    { code: PERMISSIONS.HR.PAYROLL_RUN, description: 'Run Payroll' },
    { code: PERMISSIONS.CRM.LEADS_VIEW, description: 'View Leads' },
    { code: PERMISSIONS.CRM.LEADS_EDIT, description: 'Edit Leads' },

    { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW, description: 'View Departments master data' },
    { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE, description: 'Create Departments master data' },
    { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT, description: 'Edit Departments master data' },

    { code: PERMISSIONS.MASTER_DATA.PROJECT.VIEW, description: 'View Projects master data' },
    { code: PERMISSIONS.MASTER_DATA.PROJECT.CREATE, description: 'Create Projects master data' },
    { code: PERMISSIONS.MASTER_DATA.PROJECT.EDIT, description: 'Edit Projects master data' },
    { code: PERMISSIONS.MASTER_DATA.PROJECT.CLOSE, description: 'Close Projects master data' },

    { code: PERMISSIONS.MASTER_DATA.FUND.VIEW, description: 'View Funds master data' },
    { code: PERMISSIONS.MASTER_DATA.FUND.CREATE, description: 'Create Funds master data' },
    { code: PERMISSIONS.MASTER_DATA.FUND.EDIT, description: 'Edit Funds master data' },

    { code: PERMISSIONS.AR.INVOICE_CATEGORY_VIEW, description: 'View invoice categories' },
    { code: PERMISSIONS.AR.INVOICE_CATEGORY_CREATE, description: 'Create invoice categories' },
    { code: PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE, description: 'Update invoice categories' },
    { code: PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE, description: 'Disable invoice categories' },

    { code: PERMISSIONS.FINANCE.CONFIG_VIEW, description: 'View finance configuration (posting controls)' },
    { code: PERMISSIONS.FINANCE.CONFIG_UPDATE, description: 'Update finance configuration (posting controls)' },

    { code: PERMISSIONS.AR.CREDIT_NOTE_CREATE_RBAC, description: 'Create customer credit notes (draft)' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_CREATE, description: 'Create customer credit notes (alias)' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_VIEW_RBAC, description: 'View customer credit notes' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_VIEW, description: 'View customer credit notes (alias)' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_SUBMIT_RBAC, description: 'Submit customer credit notes for approval' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_SUBMIT, description: 'Submit customer credit notes for approval (alias)' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_APPROVE_RBAC, description: 'Approve customer credit notes' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_APPROVE, description: 'Approve customer credit notes (alias)' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_POST_RBAC_ALT, description: 'Post customer credit notes' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_VOID_RBAC, description: 'Void customer credit notes' },
    { code: PERMISSIONS.AR.CREDIT_NOTE_VOID, description: 'Void customer credit notes (alias)' },

    { code: PERMISSIONS.AR.REFUND_VIEW_RBAC, description: 'View customer refunds' },
    { code: PERMISSIONS.AR.REFUND_VIEW, description: 'View customer refunds (alias)' },
    { code: PERMISSIONS.AR.REFUND_CREATE_RBAC, description: 'Create customer refunds (draft)' },
    { code: PERMISSIONS.AR.REFUND_CREATE, description: 'Create customer refunds (alias)' },
    { code: PERMISSIONS.AR.REFUND_SUBMIT_RBAC, description: 'Submit customer refunds for approval' },
    { code: PERMISSIONS.AR.REFUND_SUBMIT, description: 'Submit customer refunds for approval (alias)' },
    { code: PERMISSIONS.AR.REFUND_APPROVE_RBAC, description: 'Approve customer refunds' },
    { code: PERMISSIONS.AR.REFUND_APPROVE, description: 'Approve customer refunds (alias)' },
    { code: PERMISSIONS.AR.REFUND_POST_RBAC, description: 'Post customer refunds' },
    { code: PERMISSIONS.AR.REFUND_VOID_RBAC, description: 'Void customer refunds' },
    { code: PERMISSIONS.AR.REFUND_VOID, description: 'Void customer refunds (alias)' },
  ];

  await prisma.permission.createMany({
    data: permissions,
    skipDuplicates: true,
  });

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'ADMIN',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'ADMIN',
      description: 'Tenant administrator',
    },
    update: {},
  });

  const systemAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'SYSTEM_ADMIN',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'SYSTEM_ADMIN',
      description: 'System administrator',
    },
    update: {
      description: 'System administrator',
    },
  });

  const superAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'SUPERADMIN',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'SUPERADMIN',
      description: 'Tenant super administrator (DEV)',
    },
    update: {},
  });

  const financeOfficerRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'FINANCE_OFFICER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'FINANCE_OFFICER',
      description: 'Finance operations role',
    },
    update: {},
  });

  const financeManagerRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'FINANCE_MANAGER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'FINANCE_MANAGER',
      description: 'Finance manager role (posting)',
    },
    update: {
      description: 'Finance manager role (posting)',
    },
  });

  const financeControllerRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'FINANCE_CONTROLLER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'FINANCE_CONTROLLER',
      description: 'Finance controller role (final posting)',
    },
    update: {
      description: 'Finance controller role (final posting)',
    },
  });

  await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'AUDITOR',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'AUDITOR',
      description: 'Read-only audit role',
    },
    update: {},
  });

  const allPermissions = await prisma.permission.findMany({
    select: { id: true, code: true },
  });

  const permissionIdByCode = new Map(allPermissions.map((p) => [p.code, p.id] as const));

  async function assignPermissionsByCode(roleId: string, permissionCodes: string[]) {
    const permissionIds = permissionCodes
      .map((c) => permissionIdByCode.get(c))
      .filter(Boolean) as string[];

    if (permissionIds.length === 0) return;

    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }

  async function removePermissionsByCode(roleIds: string[], permissionCodes: string[]) {
    const permissionIds = permissionCodes
      .map((c) => permissionIdByCode.get(c))
      .filter(Boolean) as string[];

    if (roleIds.length === 0 || permissionIds.length === 0) return;

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: { in: roleIds },
        permissionId: { in: permissionIds },
      },
    });
  }

  {
    const refundPowersAndAliases = [
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_APPROVE,
      PERMISSIONS.AR.REFUND_APPROVE_RBAC,
      PERMISSIONS.AR.REFUND_POST,
      PERMISSIONS.AR.REFUND_POST_RBAC,
      PERMISSIONS.AR.REFUND_VOID,
      PERMISSIONS.AR.REFUND_VOID_RBAC,
    ];

    const officerForbidden = [
      PERMISSIONS.AR.REFUND_APPROVE,
      PERMISSIONS.AR.REFUND_APPROVE_RBAC,
      PERMISSIONS.AR.REFUND_POST,
      PERMISSIONS.AR.REFUND_POST_RBAC,
      PERMISSIONS.AR.REFUND_VOID,
      PERMISSIONS.AR.REFUND_VOID_RBAC,
    ];

    const managerForbidden = [
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_POST,
      PERMISSIONS.AR.REFUND_POST_RBAC,
      PERMISSIONS.AR.REFUND_VOID,
      PERMISSIONS.AR.REFUND_VOID_RBAC,
    ];

    const controllerForbidden = [
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_APPROVE,
      PERMISSIONS.AR.REFUND_APPROVE_RBAC,
      PERMISSIONS.AR.REFUND_VOID,
      PERMISSIONS.AR.REFUND_VOID_RBAC,
    ];

    const adminForbidden = [
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_APPROVE,
      PERMISSIONS.AR.REFUND_APPROVE_RBAC,
      PERMISSIONS.AR.REFUND_POST,
      PERMISSIONS.AR.REFUND_POST_RBAC,
    ];

    const rolesByName = await prisma.role.findMany({
      where: {
        name: {
          in: [
            'FINANCE_OFFICER',
            'FINANCE_MANAGER',
            'FINANCE_CONTROLLER',
            'SYSTEM_ADMIN',
            'SUPERADMIN',
          ],
        },
      },
      select: { id: true, name: true },
    });

    const officerRoleIds = rolesByName
      .filter((r) => r.name === 'FINANCE_OFFICER')
      .map((r) => r.id);
    const managerRoleIds = rolesByName
      .filter((r) => r.name === 'FINANCE_MANAGER')
      .map((r) => r.id);
    const controllerRoleIds = rolesByName
      .filter((r) => r.name === 'FINANCE_CONTROLLER')
      .map((r) => r.id);
    const systemAdminRoleIds = rolesByName
      .filter((r) => r.name === 'SYSTEM_ADMIN')
      .map((r) => r.id);
    const superAdminRoleIds = rolesByName
      .filter((r) => r.name === 'SUPERADMIN')
      .map((r) => r.id);

    await removePermissionsByCode(officerRoleIds, officerForbidden);
    await removePermissionsByCode(managerRoleIds, managerForbidden);
    await removePermissionsByCode(controllerRoleIds, controllerForbidden);

    await removePermissionsByCode(managerRoleIds, [
      PERMISSIONS.AR.INVOICE_POST_RBAC,
      PERMISSIONS.AP.INVOICE_POST,
      PERMISSIONS.PAYMENT.POST,
    ]);

    await removePermissionsByCode(managerRoleIds, [
      PERMISSIONS.AR.CREDIT_NOTE_POST,
    ]);

    await removePermissionsByCode(controllerRoleIds, [
      PERMISSIONS.AR.INVOICE_POST,
      PERMISSIONS.AR.INVOICE_POST_RBAC,
      PERMISSIONS.AP.INVOICE_POST,
      PERMISSIONS.AR.RECEIPT_POST,
      PERMISSIONS.PAYMENT.POST,
    ]);

    await removePermissionsByCode(systemAdminRoleIds, adminForbidden);
    await removePermissionsByCode(superAdminRoleIds, adminForbidden);

    await removePermissionsByCode(systemAdminRoleIds, [...refundPowersAndAliases]);
    await removePermissionsByCode(superAdminRoleIds, [...refundPowersAndAliases]);
  }

  await prisma.rolePermission.createMany({
    data: allPermissions
      .filter(
        (p) =>
          p.code !== PERMISSIONS.GL.FINAL_POST &&
          p.code !== PERMISSIONS.GL.POST &&
          p.code !== PERMISSIONS.COA.UNLOCK &&
          p.code !== PERMISSIONS.AR.INVOICE_POST_RBAC &&
          p.code !== PERMISSIONS.AR.INVOICE_POST &&
          p.code !== PERMISSIONS.AP.INVOICE_POST &&
          p.code !== PERMISSIONS.PAYMENT.POST &&
          p.code !== PERMISSIONS.PERIOD.CLOSE_APPROVE &&
          p.code !== PERMISSIONS.AR.INVOICE_CATEGORY_VIEW &&
          p.code !== PERMISSIONS.AR.INVOICE_CATEGORY_CREATE &&
          p.code !== PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE &&
          p.code !== PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE,
      )
      .map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
    skipDuplicates: true,
  });

  const forbiddenAdminBypassPermCodes = [
    PERMISSIONS.GL.CREATE,
    PERMISSIONS.GL.APPROVE,
    PERMISSIONS.GL.POST,
    PERMISSIONS.GL.FINAL_POST,
    PERMISSIONS.GL.RECURRING_MANAGE,
    PERMISSIONS.GL.RECURRING_GENERATE,

    PERMISSIONS.AR.INVOICE_CREATE_RBAC,
    PERMISSIONS.AR.INVOICE_SUBMIT_RBAC,
    PERMISSIONS.AR.INVOICE_APPROVE_RBAC,
    PERMISSIONS.AR.INVOICE_POST_RBAC,
    PERMISSIONS.AR.INVOICE_POST,

    PERMISSIONS.AP.INVOICE_CREATE,
    PERMISSIONS.AP.INVOICE_SUBMIT,
    PERMISSIONS.AP.INVOICE_APPROVE,
    PERMISSIONS.AP.INVOICE_POST,

    PERMISSIONS.PAYMENT.CREATE,
    PERMISSIONS.PAYMENT.APPROVE,
    PERMISSIONS.PAYMENT.POST,

    PERMISSIONS.PERIOD.CREATE,
    PERMISSIONS.PERIOD.CLOSE,
    PERMISSIONS.PERIOD.CLOSE_APPROVE,
    PERMISSIONS.PERIOD.REOPEN,
    PERMISSIONS.PERIOD.CORRECT,

    PERMISSIONS.FINANCE.CONFIG_CHANGE,

    PERMISSIONS.TAX.CONFIG_UPDATE,
    PERMISSIONS.AR.CREDIT_NOTE_APPROVE,
    PERMISSIONS.AR.CREDIT_NOTE_CREATE_RBAC,
    PERMISSIONS.AR.CREDIT_NOTE_VIEW_RBAC,
    PERMISSIONS.AR.CREDIT_NOTE_SUBMIT_RBAC,
    PERMISSIONS.AR.CREDIT_NOTE_APPROVE_RBAC,
    PERMISSIONS.AR.CREDIT_NOTE_VOID_RBAC,
    PERMISSIONS.AR.REFUND_VIEW_RBAC,
    PERMISSIONS.AR.REFUND_VIEW,
    PERMISSIONS.AR.REFUND_CREATE_RBAC,
    PERMISSIONS.AR.REFUND_CREATE,
    PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
    PERMISSIONS.AR.REFUND_SUBMIT,
    PERMISSIONS.AR.REFUND_APPROVE_RBAC,
    PERMISSIONS.AR.REFUND_APPROVE,
    PERMISSIONS.AR.REFUND_POST_RBAC,
    PERMISSIONS.AR.REFUND_POST,
    PERMISSIONS.AR.REFUND_VOID_RBAC,
    PERMISSIONS.AR.REFUND_VOID,

    PERMISSIONS.AR.RECEIPT_POST,
    PERMISSIONS.AR.CREDIT_NOTE_POST,
  ] as const;

  await removePermissionsByCode([superAdminRole.id, systemAdminRole.id, adminRole.id], Array.from(forbiddenAdminBypassPermCodes));

  await assignPermissionsByCode(superAdminRole.id, [
    PERMISSIONS.SYSTEM.VIEW_ALL,
    PERMISSIONS.FINANCE.VIEW_ALL,
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
    PERMISSIONS.USER.CREATE,
    PERMISSIONS.USER.VIEW,
    PERMISSIONS.USER.EDIT,
    PERMISSIONS.ROLE.VIEW,
    PERMISSIONS.ROLE.ASSIGN,
    PERMISSIONS.AR.CREDIT_NOTE_VIEW,
    PERMISSIONS.AR.CREDIT_NOTE_VOID,
  ]);

  await assignPermissionsByCode(systemAdminRole.id, [
    PERMISSIONS.SYSTEM.VIEW_ALL,
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
    PERMISSIONS.USER.CREATE,
    PERMISSIONS.USER.VIEW,
    PERMISSIONS.USER.EDIT,
    PERMISSIONS.ROLE.VIEW,
    PERMISSIONS.ROLE.ASSIGN,
  ]);

  // AR Aging (AR-1) RBAC backfill (idempotent):
  // Allow view-only AR aging report access for governed roles.
  await assignPermissionsByCode(superAdminRole.id, [PERMISSIONS.AR_AGING.VIEW]);
  await assignPermissionsByCode(financeManagerRole.id, [PERMISSIONS.AR_AGING.VIEW]);
  await assignPermissionsByCode(financeControllerRole.id, [PERMISSIONS.AR_AGING.VIEW]);

  // AR Statements (AR-STATEMENTS) RBAC backfill (idempotent):
  // Allow view-only customer statement access for governed finance roles.
  // Do NOT auto-grant to ADMIN; admins rely on FINANCE_VIEW_ALL / SYSTEM_VIEW_ALL visibility only.
  await assignPermissionsByCode(financeOfficerRole.id, [PERMISSIONS.AR_STATEMENT.VIEW]);
  await assignPermissionsByCode(financeManagerRole.id, [PERMISSIONS.AR_STATEMENT.VIEW]);
  await assignPermissionsByCode(financeControllerRole.id, [PERMISSIONS.AR_STATEMENT.VIEW]);

  // AR Reminders (AR-REMINDERS) RBAC backfill (idempotent):
  // Permission-based governance only.
  await assignPermissionsByCode(financeOfficerRole.id, [PERMISSIONS.AR_REMINDER.VIEW, PERMISSIONS.AR_REMINDER.TRIGGER]);
  await assignPermissionsByCode(financeManagerRole.id, [PERMISSIONS.AR_REMINDER.VIEW, PERMISSIONS.AR_REMINDER.TRIGGER, PERMISSIONS.AR_REMINDER.CONFIGURE]);
  await assignPermissionsByCode(financeControllerRole.id, [PERMISSIONS.AR_REMINDER.VIEW, PERMISSIONS.AR_REMINDER.TRIGGER, PERMISSIONS.AR_REMINDER.CONFIGURE]);

  // AP Suppliers (AP-2/AP-3) RBAC backfill (idempotent):
  // - Users who can create suppliers must also be able to view suppliers.
  // - Import is allowed for governed finance roles only.
  await assignPermissionsByCode(financeOfficerRole.id, [
    PERMISSIONS.AP.SUPPLIER_CREATE,
    PERMISSIONS.AP.SUPPLIER_VIEW,
    PERMISSIONS.AP.SUPPLIER_IMPORT,
  ]);
  await assignPermissionsByCode(financeManagerRole.id, [
    PERMISSIONS.AP.SUPPLIER_CREATE,
    PERMISSIONS.AP.SUPPLIER_VIEW,
    PERMISSIONS.AP.SUPPLIER_IMPORT,
  ]);
  await assignPermissionsByCode(financeControllerRole.id, [PERMISSIONS.AP.SUPPLIER_VIEW]);

  await assignPermissionsByCode(superAdminRole.id, [
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT.EVIDENCE_UPLOAD,
    PERMISSIONS.AUDIT.EVIDENCE_VIEW,
    PERMISSIONS.AUDIT.REVIEW_PACK_VIEW,
    PERMISSIONS.AUDIT.REVIEW_PACK_GENERATE,
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW,
    PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE,
    PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT,
    PERMISSIONS.MASTER_DATA.PROJECT.VIEW,
    PERMISSIONS.MASTER_DATA.PROJECT.CREATE,
    PERMISSIONS.MASTER_DATA.PROJECT.EDIT,
    PERMISSIONS.MASTER_DATA.PROJECT.CLOSE,
    PERMISSIONS.MASTER_DATA.FUND.VIEW,
    PERMISSIONS.MASTER_DATA.FUND.CREATE,
    PERMISSIONS.MASTER_DATA.FUND.EDIT,
    PERMISSIONS.AR.INVOICE_CATEGORY_VIEW,
    PERMISSIONS.AR.INVOICE_CATEGORY_CREATE,
    PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE,
    PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE,
  ]);

  await assignPermissionsByCode(systemAdminRole.id, [
    // SYSTEM_ADMIN is system-only (no finance configuration/posting permissions).
  ]);

  const forecastCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.FORECAST.CREATE }, select: { id: true } });
  const forecastEditPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.FORECAST.EDIT }, select: { id: true } });
  const forecastSubmitPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.FORECAST.SUBMIT }, select: { id: true } });
  const forecastApprovePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.FORECAST.APPROVE }, select: { id: true } });
  const forecastViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.FORECAST.VIEW }, select: { id: true } });

  const financeOfficerRoleFound = await prisma.role.findFirst({
    where: { tenantId: tenant.id, name: 'FINANCE_OFFICER' },
    select: { id: true },
  });

  const glViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.VIEW }, select: { id: true } });
  const glCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.CREATE }, select: { id: true } });
  const glPostPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.POST }, select: { id: true } });
  const glFinalPostPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.FINAL_POST }, select: { id: true } });
  const glApprovePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.APPROVE }, select: { id: true } });
  const glRecurringManagePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.RECURRING_MANAGE }, select: { id: true } });
  const periodViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.PERIOD.VIEW }, select: { id: true } });

  // Governance: FINANCE_OFFICER must not have FINANCE_GL_APPROVE. This is additive-only cleanup for past seeds.
  if (glApprovePerm?.id) {
    const financeOfficerRoles = await prisma.role.findMany({
      where: { name: 'FINANCE_OFFICER' },
      select: { id: true },
    });

    if (financeOfficerRoles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: financeOfficerRoles.map((r) => r.id) },
          permissionId: glApprovePerm.id,
        },
      });
    }
  }

  // Governance: FINANCE_OFFICER must not have FINANCE_GL_FINAL_POST.
  // This is additive-only cleanup for past seeds.
  if (glFinalPostPerm?.id) {
    const financeOfficerRoles = await prisma.role.findMany({
      where: { name: 'FINANCE_OFFICER' },
      select: { id: true },
    });

    if (financeOfficerRoles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: financeOfficerRoles.map((r) => r.id) },
          permissionId: glFinalPostPerm.id,
        },
      });
    }
  }

  const periodChecklistViewPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.PERIOD.CHECKLIST_VIEW },
    select: { id: true },
  });
  const periodChecklistCompletePerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE },
    select: { id: true },
  });
  const periodClosePerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.PERIOD.CLOSE },
    select: { id: true },
  });
  const periodCloseApprovePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.PERIOD.CLOSE_APPROVE }, select: { id: true } });
  const periodReopenPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.PERIOD.REOPEN }, select: { id: true } });
  const disclosureGeneratePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.DISCLOSURE_GENERATE }, select: { id: true } });
  const disclosureViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.DISCLOSURE_VIEW }, select: { id: true } });
  const budgetSetupPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.BUDGET.SETUP }, select: { id: true } });
  const financeBudgetViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.BUDGET.FINANCE_VIEW }, select: { id: true } });
  const reportGeneratePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.REPORT_GENERATE }, select: { id: true } });
  const reportExportPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.REPORT_EXPORT }, select: { id: true } });

  const mdDepartmentViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW }, select: { id: true } });
  const mdDepartmentCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE }, select: { id: true } });
  const mdDepartmentEditPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT }, select: { id: true } });

  const mdProjectViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.PROJECT.VIEW }, select: { id: true } });
  const mdProjectCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.PROJECT.CREATE }, select: { id: true } });
  const mdProjectEditPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.PROJECT.EDIT }, select: { id: true } });
  const mdProjectClosePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.PROJECT.CLOSE }, select: { id: true } });

  const mdFundViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.FUND.VIEW }, select: { id: true } });
  const mdFundCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.FUND.CREATE }, select: { id: true } });
  const mdFundEditPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.MASTER_DATA.FUND.EDIT }, select: { id: true } });

  const invoiceCategoryViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.AR.INVOICE_CATEGORY_VIEW }, select: { id: true } });
  const invoiceCategoryCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.AR.INVOICE_CATEGORY_CREATE }, select: { id: true } });
  const invoiceCategoryUpdatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE }, select: { id: true } });
  const invoiceCategoryDisablePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE }, select: { id: true } });

  const taxRateViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.TAX.RATE_VIEW }, select: { id: true } });
  const taxRateCreatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.TAX.RATE_CREATE }, select: { id: true } });
  const taxRateUpdatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.TAX.RATE_UPDATE }, select: { id: true } });
  const taxConfigUpdatePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.TAX.CONFIG_UPDATE }, select: { id: true } });

  // SYSTEM_ADMIN governance: allow managing invoice categories.
  // Additive-only and safe to re-run.
  const systemAdminInvoiceCategoryPermIds = [
    invoiceCategoryViewPerm?.id,
    invoiceCategoryCreatePerm?.id,
    invoiceCategoryUpdatePerm?.id,
    invoiceCategoryDisablePerm?.id,
  ].filter(Boolean) as string[];
  if (systemAdminRole?.id && systemAdminInvoiceCategoryPermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: systemAdminInvoiceCategoryPermIds.map((permissionId) => ({
        roleId: systemAdminRole.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  // Tax governance: SYSTEM_ADMIN + FINANCE_CONTROLLER can manage tax rates and configuration.
  // Additive-only and safe to re-run.
  const taxPermIds = [
    taxRateViewPerm?.id,
    taxRateCreatePerm?.id,
    taxRateUpdatePerm?.id,
    taxConfigUpdatePerm?.id,
  ].filter(Boolean) as string[];
  if (taxPermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: taxPermIds
        .map((permissionId) => [systemAdminRole?.id, financeControllerRole?.id]
          .filter(Boolean)
          .map((roleId) => ({ roleId: roleId as string, permissionId })))
        .flat(),
      skipDuplicates: true,
    });
  }

  // Ensure TenantTaxConfig row exists (nullable VAT accounts; must be set via Settings before posting taxable invoices).
  await (prisma as any).tenantTaxConfig.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id },
    update: {},
  });

  // Seed default OUTPUT tax rates if tenant has none.
  const existingTaxRateCount = await prisma.taxRate.count({ where: { tenantId: tenant.id } });
  if (existingTaxRateCount === 0) {
    await prisma.taxRate.createMany({
      data: [
        { tenantId: tenant.id, code: 'VAT16', name: 'VAT16', rate: 16.0, type: 'OUTPUT', isActive: true },
        { tenantId: tenant.id, code: 'VAT0', name: 'VAT0', rate: 0.0, type: 'OUTPUT', isActive: true },
        { tenantId: tenant.id, code: 'EXEMPT', name: 'EXEMPT', rate: 0.0, type: 'OUTPUT', isActive: true },
      ] as any,
      skipDuplicates: true,
    });
  }
  const glRecurringGeneratePerm = await prisma.permission.upsert({
    where: { code: PERMISSIONS.GL.RECURRING_GENERATE },
    create: {
      code: PERMISSIONS.GL.RECURRING_GENERATE,
      description: 'Generate journals from recurring templates',
    },
    update: {
      description: 'Generate journals from recurring templates',
    },
    select: { id: true },
  });

  // Backfill: ensure all FINANCE_OFFICER roles (across all tenants) have recurring generate.
  // This is additive-only and safe to re-run.
  if (glRecurringGeneratePerm?.id) {
    const allFinanceOfficerRoles = await prisma.role.findMany({
      where: { name: 'FINANCE_OFFICER' },
      select: { id: true },
    });

    if (allFinanceOfficerRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: allFinanceOfficerRoles.map((r) => ({
          roleId: r.id,
          permissionId: glRecurringGeneratePerm.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Backfill: ensure FINANCE_MANAGER / FINANCE_CONTROLLER can run + export financial statements.
  // Additive-only and safe to re-run.
  const statementGenerateExportPermIds = [reportGeneratePerm?.id, reportExportPerm?.id].filter(Boolean) as string[];
  if (statementGenerateExportPermIds.length > 0) {
    const rolesNeedingGenerateExport = await prisma.role.findMany({
      where: {
        name: {
          in: ['FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (rolesNeedingGenerateExport.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingGenerateExport.flatMap((r) =>
          statementGenerateExportPermIds.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }

    // Ensure FINANCE_OFFICER does not have generate/export.
    const financeOfficerRoles = await prisma.role.findMany({
      where: {
        name: 'FINANCE_OFFICER',
      },
      select: { id: true },
    });

    if (financeOfficerRoles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: financeOfficerRoles.map((r) => r.id) },
          permissionId: { in: statementGenerateExportPermIds },
        },
      });
    }
  }

  // Financial statements (requested) RBAC backfill (idempotent):
  // - Assign view-only permissions for Cash Flow, SOE, and Disclosure Notes to FINANCE_OFFICER / FINANCE_MANAGER / FINANCE_CONTROLLER.
  // - Do NOT assign to any other roles.
  const cashflowViewPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.REPORT.CASHFLOW_VIEW },
    select: { id: true },
  });
  const soeViewPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.REPORT.SOE_VIEW },
    select: { id: true },
  });

  const statementViewPermIds = [
    cashflowViewPerm?.id,
    soeViewPerm?.id,
    disclosureViewPerm?.id,
  ].filter(Boolean) as string[];

  if (statementViewPermIds.length > 0) {
    const allowedStatementRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['FINANCE_OFFICER', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (allowedStatementRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: allowedStatementRoles.flatMap((r) =>
          statementViewPermIds.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }

    // Remove from any roles other than the allowed set.
    const forbiddenStatementRoles = await prisma.role.findMany({
      where: {
        name: {
          notIn: ['FINANCE_OFFICER', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (forbiddenStatementRoles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: forbiddenStatementRoles.map((r) => r.id) },
          permissionId: { in: statementViewPermIds },
        },
      });
    }
  }

  // Backfill: ensure ADMIN has BUDGET_SETUP.
  // Additive-only and safe to re-run.
  if (budgetSetupPerm?.id) {
    const rolesNeedingBudgetSetup = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN'],
        },
      },
      select: { id: true },
    });

    if (rolesNeedingBudgetSetup.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingBudgetSetup.map((r) => ({
          roleId: r.id,
          permissionId: budgetSetupPerm.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Backfill: ensure ADMIN / FINANCE_MANAGER / FINANCE_OFFICER have disclosure note permissions.
  // Additive-only and safe to re-run.
  if (disclosureGeneratePerm?.id || disclosureViewPerm?.id) {
    const rolesNeedingDisclosurePerms = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_OFFICER'],
        },
      },
      select: { id: true },
    });

    const permIds = [disclosureGeneratePerm?.id, disclosureViewPerm?.id].filter(Boolean) as string[];

    if (rolesNeedingDisclosurePerms.length > 0 && permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingDisclosurePerms.flatMap((r) =>
          permIds.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }
  }

  // Backfill: ensure ADMIN / FINANCE_MANAGER / FINANCE_OFFICER all have FINANCE_PERIOD_VIEW.
  // Additive-only and safe to re-run.
  if (periodViewPerm?.id) {
    const rolesNeedingPeriodView = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_OFFICER'],
        },
      },
      select: { id: true },
    });

    if (rolesNeedingPeriodView.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingPeriodView.map((r) => ({
          roleId: r.id,
          permissionId: periodViewPerm.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (financeOfficerRoleFound?.id) {
    await prisma.rolePermission.createMany({
      data: [
        periodViewPerm?.id,
      ]
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: financeOfficerRoleFound.id,
          permissionId: permissionId as string,
        })),
      skipDuplicates: true,
    });

    await assignPermissionsByCode(financeOfficerRole.id, [
      PERMISSIONS.AR.INVOICE_CREATE_RBAC,
      PERMISSIONS.AR.INVOICE_CREATE,
      PERMISSIONS.AR.INVOICE_EDIT_DRAFT,
      PERMISSIONS.AR.INVOICE_VIEW_RBAC,
      PERMISSIONS.AR.INVOICE_VIEW,
      PERMISSIONS.AR.RECEIPT_CREATE_RBAC,
      PERMISSIONS.AR.RECEIPT_CREATE,
      PERMISSIONS.AR.RECEIPT_VIEW_RBAC,
      PERMISSIONS.AR.RECEIPT_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
      PERMISSIONS.AR.CREDIT_NOTE_VIEW_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_SUBMIT_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_SUBMIT,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_VIEW_RBAC,
      PERMISSIONS.AR.REFUND_VIEW,

      PERMISSIONS.AR.INVOICE_CATEGORY_VIEW,
      PERMISSIONS.TAX.RATE_VIEW,
      PERMISSIONS.GL.VIEW,
      PERMISSIONS.GL.CREATE,
      PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW,
      PERMISSIONS.MASTER_DATA.PROJECT.VIEW,
      PERMISSIONS.MASTER_DATA.FUND.VIEW,

      PERMISSIONS.AP.INVOICE_VIEW,
      PERMISSIONS.AP.INVOICE_CREATE,
      PERMISSIONS.AP.INVOICE_SUBMIT,

      PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
    ]);

    const financeOfficerAllowedCodes = [
      PERMISSIONS.AR.INVOICE_CREATE_RBAC,
      PERMISSIONS.AR.INVOICE_CREATE,
      PERMISSIONS.AR.INVOICE_EDIT_DRAFT,
      PERMISSIONS.AR.INVOICE_VIEW_RBAC,
      PERMISSIONS.AR.INVOICE_VIEW,
      PERMISSIONS.AR.RECEIPT_CREATE_RBAC,
      PERMISSIONS.AR.RECEIPT_CREATE,
      PERMISSIONS.AR.RECEIPT_VIEW_RBAC,
      PERMISSIONS.AR.RECEIPT_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_CREATE,
      PERMISSIONS.AR.CREDIT_NOTE_VIEW_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_SUBMIT_RBAC,
      PERMISSIONS.AR.CREDIT_NOTE_SUBMIT,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_VIEW_RBAC,
      PERMISSIONS.AR.REFUND_VIEW,

      PERMISSIONS.AR.INVOICE_CATEGORY_VIEW,
      PERMISSIONS.TAX.RATE_VIEW,
      PERMISSIONS.GL.VIEW,
      PERMISSIONS.GL.CREATE,
      PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW,
      PERMISSIONS.MASTER_DATA.PROJECT.VIEW,
      PERMISSIONS.MASTER_DATA.FUND.VIEW,

      PERMISSIONS.AP.SUPPLIER_VIEW,
      PERMISSIONS.AP.SUPPLIER_CREATE,
      PERMISSIONS.AP.SUPPLIER_IMPORT,
      PERMISSIONS.AP.INVOICE_VIEW,
      PERMISSIONS.AP.INVOICE_CREATE,
      PERMISSIONS.AP.INVOICE_SUBMIT,
      PERMISSIONS.AR_STATEMENT.VIEW,
      PERMISSIONS.AR_REMINDER.VIEW,
      PERMISSIONS.AR_REMINDER.TRIGGER,
      PERMISSIONS.PERIOD.VIEW,
      PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
    ] as const;

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: financeOfficerRoleFound.id,
        permission: { code: { notIn: Array.from(financeOfficerAllowedCodes) } },
      },
    });
  }

  // Seed default invoice categories per tenant (only if tenant has none).
  // These are defaults, but remain editable via RBAC.
  const existingInvoiceCategoryCount = await (prisma as any).invoiceCategory.count({
    where: { tenantId: tenant.id },
  });

  if (existingInvoiceCategoryCount === 0) {
    const defaults: Array<{
      code: string;
      name: string;
      revenueAccountCode: string;
      requiresProject: boolean;
      requiresFund: boolean;
      requiresDepartment: boolean;
    }> = [
      {
        code: 'TRAINING',
        name: 'Training',
        revenueAccountCode: '40160',
        requiresProject: true,
        requiresFund: false,
        requiresDepartment: false,
      },
      {
        code: 'CONSULTING',
        name: 'Consulting',
        revenueAccountCode: '40120',
        requiresProject: true,
        requiresFund: false,
        requiresDepartment: false,
      },
      {
        code: 'SYSTEMS',
        name: 'Systems',
        revenueAccountCode: '40180',
        requiresProject: true,
        requiresFund: false,
        requiresDepartment: false,
      },
      {
        code: 'PUBLISHING',
        name: 'Publishing',
        revenueAccountCode: '40200',
        requiresProject: false,
        requiresFund: false,
        requiresDepartment: false,
      },
      {
        code: 'DONATION',
        name: 'Donation',
        revenueAccountCode: '70140',
        requiresProject: false,
        requiresFund: false,
        requiresDepartment: false,
      },
    ];

    for (const c of defaults) {
      const revenueAccount = await prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          code: c.revenueAccountCode,
          isActive: true,
          type: 'INCOME' as any,
        } as any,
        select: { id: true } as any,
      } as any);

      if (!revenueAccount?.id) {
        continue;
      }

      await (prisma as any).invoiceCategory.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: c.code,
          },
        },
        create: {
          tenantId: tenant.id,
          code: c.code,
          name: c.name,
          isActive: true,
          isSystemDefault: true,
          revenueAccountId: revenueAccount.id,
          requiresProject: c.requiresProject,
          requiresFund: c.requiresFund,
          requiresDepartment: c.requiresDepartment,
        },
        update: {
          name: c.name,
          revenueAccountId: revenueAccount.id,
          requiresProject: c.requiresProject,
          requiresFund: c.requiresFund,
          requiresDepartment: c.requiresDepartment,
        },
      });
    }
  }

  if (financeManagerRole?.id) {
    await prisma.rolePermission.createMany({
      data: [
        glViewPerm?.id,
        glApprovePerm?.id,
        glRecurringManagePerm?.id,
        glRecurringGeneratePerm?.id,
        periodViewPerm?.id,
        periodChecklistViewPerm?.id,
        periodChecklistCompletePerm?.id,
        periodReopenPerm?.id,
        financeBudgetViewPerm?.id,
      ]
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: financeManagerRole.id,
          permissionId: permissionId as string,
        })),
      skipDuplicates: true,
    });

    await assignPermissionsByCode(financeManagerRole.id, [
      PERMISSIONS.AR.INVOICE_VIEW,
      PERMISSIONS.AR.INVOICE_APPROVE_RBAC,
      PERMISSIONS.AP.INVOICE_APPROVE,
      PERMISSIONS.AP.INVOICE_VIEW,
      PERMISSIONS.AP.INVOICE_CREATE,
      PERMISSIONS.AP.INVOICE_SUBMIT,
      PERMISSIONS.PAYMENT.APPROVE,
      PERMISSIONS.PAYMENT.RELEASE,
      PERMISSIONS.GL.APPROVE,
      PERMISSIONS.GL.RECURRING_MANAGE,
      PERMISSIONS.GL.RECURRING_GENERATE,
      PERMISSIONS.PERIOD.CHECKLIST_VIEW,
      PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
      PERMISSIONS.PERIOD.CLOSE,

      PERMISSIONS.AR.RECEIPT_VIEW,
      PERMISSIONS.AR.RECEIPT_POST,

      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_APPROVE,

      PERMISSIONS.AR.REFUND_VIEW,
      PERMISSIONS.AR.REFUND_APPROVE,
    ]);

    if (periodCloseApprovePerm?.id) {
      const financeManagerRoles = await prisma.role.findMany({
        where: { name: 'FINANCE_MANAGER' },
        select: { id: true },
      });

      if (financeManagerRoles.length > 0) {
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: { in: financeManagerRoles.map((r) => r.id) },
            permissionId: periodCloseApprovePerm.id,
          },
        });
      }
    }
  }

  // Backfill: ensure ADMIN can close periods (still checklist-gated by backend).
  // Additive-only and safe to re-run.
  if (periodClosePerm?.id) {
    const adminRoles = await prisma.role.findMany({
      where: { name: 'ADMIN' },
      select: { id: true },
    });

    if (adminRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: adminRoles.map((r) => ({
          roleId: r.id,
          permissionId: periodClosePerm.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (financeControllerRole?.id) {
    await prisma.rolePermission.createMany({
      data: [
        glViewPerm?.id,
        glFinalPostPerm?.id,
        periodViewPerm?.id,
        periodChecklistViewPerm?.id,
        periodChecklistCompletePerm?.id,
        periodClosePerm?.id,

        mdDepartmentViewPerm?.id,
        mdDepartmentCreatePerm?.id,
        mdDepartmentEditPerm?.id,
        mdProjectViewPerm?.id,
        mdProjectCreatePerm?.id,
        mdProjectEditPerm?.id,
        mdProjectClosePerm?.id,
        mdFundViewPerm?.id,
        mdFundCreatePerm?.id,
        mdFundEditPerm?.id,

        invoiceCategoryViewPerm?.id,
        invoiceCategoryCreatePerm?.id,
        invoiceCategoryUpdatePerm?.id,
        invoiceCategoryDisablePerm?.id,
      ]
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: financeControllerRole.id,
          permissionId: permissionId as string,
        })),
      skipDuplicates: true,
    });

    await assignPermissionsByCode(financeControllerRole.id, [
      PERMISSIONS.SYSTEM.CONFIG_VIEW,
      PERMISSIONS.SYSTEM.CONFIG_UPDATE,
      PERMISSIONS.FINANCE.CONFIG_CHANGE,
      PERMISSIONS.FINANCE.CONFIG_VIEW,
      PERMISSIONS.FINANCE.CONFIG_UPDATE,

      PERMISSIONS.AR.INVOICE_POST_RBAC,
      PERMISSIONS.AP.INVOICE_POST,
      PERMISSIONS.PAYMENT.POST,

      PERMISSIONS.AP.INVOICE_VIEW,
      PERMISSIONS.AP.INVOICE_CREATE,
      PERMISSIONS.AP.INVOICE_SUBMIT,
      PERMISSIONS.AP.INVOICE_APPROVE,

      PERMISSIONS.AR.RECEIPT_VIEW,

      PERMISSIONS.AR.CREDIT_NOTE_VIEW,
      PERMISSIONS.AR.CREDIT_NOTE_POST,

      PERMISSIONS.AR.REFUND_VIEW,
      PERMISSIONS.AR.REFUND_POST,
      PERMISSIONS.AR.INVOICE_VIEW,
      PERMISSIONS.PERIOD.CLOSE_APPROVE,
      PERMISSIONS.PERIOD.CORRECT,

      PERMISSIONS.AR.CREDIT_NOTE_VIEW_RBAC,

      PERMISSIONS.AR.REFUND_VIEW_RBAC,
    ]);

    // Governance: controller must not be able to void credit notes or refunds.
    await removePermissionsByCode([financeControllerRole.id], [
      PERMISSIONS.AR.CREDIT_NOTE_VOID,
      PERMISSIONS.AR.CREDIT_NOTE_VOID_RBAC,
      PERMISSIONS.AR.REFUND_VOID,
      PERMISSIONS.AR.REFUND_VOID_RBAC,
      PERMISSIONS.AR.REFUND_APPROVE,
      PERMISSIONS.AR.REFUND_APPROVE_RBAC,
      PERMISSIONS.AR.REFUND_CREATE,
      PERMISSIONS.AR.REFUND_CREATE_RBAC,
      PERMISSIONS.AR.REFUND_SUBMIT,
      PERMISSIONS.AR.REFUND_SUBMIT_RBAC,
    ]);
  }

  // AR Receipts (AR-2) RBAC backfill (idempotent):
  // - ADMIN / FINANCE_OFFICER / FINANCE_MANAGER / FINANCE_CONTROLLER must have:
  //   - AR_RECEIPTS_VIEW
  // - FINANCE_OFFICER must have:
  //   - AR_RECEIPTS_CREATE
  const arReceiptsViewPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.AR.RECEIPT_VIEW_RBAC },
    select: { id: true },
  });
  const arReceiptsCreatePerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.AR.RECEIPT_CREATE_RBAC },
    select: { id: true },
  });

  const arReceiptsViewId = arReceiptsViewPerm?.id ? [arReceiptsViewPerm.id] : [];
  if (arReceiptsViewId.length > 0) {
    const arReceiptsRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_OFFICER', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (arReceiptsRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: arReceiptsRoles.flatMap((r) =>
          arReceiptsViewId.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }
  }

  const arReceiptsCreateId = arReceiptsCreatePerm?.id ? [arReceiptsCreatePerm.id] : [];
  if (arReceiptsCreateId.length > 0) {
    const officerRoles = await prisma.role.findMany({
      where: { name: 'FINANCE_OFFICER' },
      select: { id: true },
    });
    if (officerRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: officerRoles.flatMap((r) =>
          arReceiptsCreateId.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }
  }

  // Customer Master (AR-CUSTOMERS) RBAC backfill (idempotent):
  // - ADMIN / FINANCE_OFFICER / FINANCE_MANAGER / FINANCE_CONTROLLER must have:
  //   - CUSTOMERS_VIEW
  //   - CUSTOMERS_CREATE
  //   - CUSTOMERS_EDIT
  //   - CUSTOMERS_IMPORT
  const customersViewPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.CUSTOMERS.VIEW },
    select: { id: true },
  });
  const customersCreatePerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.CUSTOMERS.CREATE },
    select: { id: true },
  });
  const customersEditPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.CUSTOMERS.EDIT },
    select: { id: true },
  });
  const customersImportPerm = await prisma.permission.findUnique({
    where: { code: PERMISSIONS.CUSTOMERS.IMPORT },
    select: { id: true },
  });

  const customersPermIds = [
    customersViewPerm?.id,
    customersCreatePerm?.id,
    customersEditPerm?.id,
    customersImportPerm?.id,
  ].filter(Boolean) as string[];

  if (customersPermIds.length > 0) {
    const customerRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_OFFICER', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (customerRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: customerRoles.flatMap((r) =>
          customersPermIds.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }
  }

  // Backfill: ensure ADMIN / FINANCE_MANAGER / FINANCE_CONTROLLER have FINANCE_BUDGET_VIEW.
  // Additive-only and safe to re-run.
  if (financeBudgetViewPerm?.id) {
    const rolesNeedingBudgetView = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (rolesNeedingBudgetView.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingBudgetView.map((r) => ({
          roleId: r.id,
          permissionId: financeBudgetViewPerm.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  const coaViewFinancePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.COA.VIEW }, select: { id: true } });
  const coaUpdateFinancePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.COA.UPDATE }, select: { id: true } });
  const coaUnlockPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.COA.UNLOCK }, select: { id: true } });
  const reportsModuleViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.REPORTS_VIEW }, select: { id: true } });

  // COA RBAC backfill (idempotent):
  // - ADMIN: view + update
  // - FINANCE_CONTROLLER: view + update
  // - FINANCE_MANAGER: view only
  // - FINANCE_OFFICER: none
  const coaPermIds = [coaViewFinancePerm?.id, coaUpdateFinancePerm?.id].filter(Boolean) as string[];
  const coaViewPermId = coaViewFinancePerm?.id ? [coaViewFinancePerm.id] : [];

  // COA governance: FINANCE_MANAGER is view-only.
  if (financeManagerRole?.id) {
    const permIds = coaViewPermId;

    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({
          roleId: financeManagerRole.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  // COA governance: FINANCE_CONTROLLER can view + edit.
  if (financeControllerRole?.id) {
    const permIds = coaPermIds;

    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({
          roleId: financeControllerRole.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Ensure ADMIN has COA view + update even on older DBs.
  if (adminRole?.id && coaPermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: coaPermIds.map((permissionId) => ({
        roleId: adminRole.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  // Ensure FINANCE_OFFICER does not have COA permissions.
  if (financeOfficerRole?.id && coaPermIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: financeOfficerRole.id,
        permissionId: { in: coaPermIds },
      },
    });
  }

  // Reports RBAC backfill (idempotent):
  // - FINANCE_MANAGER + FINANCE_CONTROLLER should be able to run financial statements.
  // - FINANCE_OFFICER must not.
  // NOTE: endpoints use a mix of legacy and new permissions; grant the minimal set to support TB/PL/BS and their presentation routes.
  const tbViewPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.TB_VIEW }, select: { id: true } });
  const plLegacyPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.PL_VIEW_LEGACY }, select: { id: true } });
  const bsLegacyPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.BS_VIEW_LEGACY }, select: { id: true } });
  const pnlEnginePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.PNL_VIEW }, select: { id: true } });
  const bsEnginePerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.BALANCE_SHEET_VIEW }, select: { id: true } });
  const plPresentationPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.PRESENTATION_PL_VIEW }, select: { id: true } });
  const bsPresentationPerm = await prisma.permission.findUnique({ where: { code: PERMISSIONS.REPORT.PRESENTATION_BS_VIEW }, select: { id: true } });

  const reportPermIds = [
    reportsModuleViewPerm?.id,
    tbViewPerm?.id,
    plLegacyPerm?.id,
    bsLegacyPerm?.id,
    pnlEnginePerm?.id,
    bsEnginePerm?.id,
    plPresentationPerm?.id,
    bsPresentationPerm?.id,
  ].filter(Boolean) as string[];

  if (reportPermIds.length > 0) {
    const rolesNeedingReportPerms = await prisma.role.findMany({
      where: {
        name: {
          in: ['FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
        },
      },
      select: { id: true },
    });

    if (rolesNeedingReportPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolesNeedingReportPerms.flatMap((r) =>
          reportPermIds.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
        ),
        skipDuplicates: true,
      });
    }

    // Ensure FINANCE_OFFICER does not have financial statements permissions.
    const financeOfficerRoles = await prisma.role.findMany({
      where: {
        name: 'FINANCE_OFFICER',
      },
      select: { id: true },
    });

    if (financeOfficerRoles.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: financeOfficerRoles.map((r) => r.id) },
          permissionId: { in: reportPermIds },
        },
      });
    }
  }

  // COA governance: unlock is controller-only.
  // Explicitly add for FINANCE_CONTROLLER, and explicitly remove for ADMIN / FINANCE_MANAGER / FINANCE_OFFICER.
  if (coaUnlockPerm?.id) {
    // Backfill: ensure all FINANCE_CONTROLLER roles (across all tenants) have unlock.
    const allFinanceControllerRoles = await prisma.role.findMany({
      where: { name: 'FINANCE_CONTROLLER' },
      select: { id: true },
    });

    if (allFinanceControllerRoles.length > 0) {
      await prisma.rolePermission.createMany({
        data: allFinanceControllerRoles.map((r) => ({
          roleId: r.id,
          permissionId: coaUnlockPerm.id,
        })),
        skipDuplicates: true,
      });
    }

    // Remove from roles that must not hold this permission.
    const rolesForbiddenCoaUnlock = await prisma.role.findMany({
      where: {
        name: {
          in: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_OFFICER'],
        },
      },
      select: { id: true },
    });

    if (rolesForbiddenCoaUnlock.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: { in: rolesForbiddenCoaUnlock.map((r) => r.id) },
          permissionId: coaUnlockPerm.id,
        },
      });
    }
  }

  // Control-first SoD: admin can approve but cannot be a maker for forecasts.
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: adminRole.id,
      permissionId: {
        in: [forecastCreatePerm?.id, forecastEditPerm?.id, forecastSubmitPerm?.id].filter(Boolean) as string[],
      },
    },
  });

  const forecastMakerRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'FORECAST_MAKER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'FORECAST_MAKER',
      description: 'Can create and manage draft forecasts but cannot approve',
    },
    update: {
      description: 'Can create and manage draft forecasts but cannot approve',
    },
  });

  const makerPermIds = [forecastCreatePerm?.id, forecastEditPerm?.id, forecastSubmitPerm?.id, forecastViewPerm?.id].filter(
    Boolean,
  ) as string[];

  await prisma.rolePermission.createMany({
    data: makerPermIds.map((permissionId) => ({
      roleId: forecastMakerRole.id,
      permissionId,
    })),
    skipDuplicates: true,
  });

  // Enforce FORECAST_MAKER = maker-only permissions (remove any accidentally retained permissions).
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: forecastMakerRole.id,
      permissionId: {
        notIn: makerPermIds,
      },
    },
  });

  // Extra guard: explicitly ensure maker role never has approve.
  if (forecastApprovePerm?.id) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: forecastMakerRole.id,
        permissionId: forecastApprovePerm.id,
      },
    });
  }

  const viewerRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'PERIOD_CLOSE_VIEWER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'PERIOD_CLOSE_VIEWER',
      description: 'Can view period close checklist but cannot complete items',
    },
    update: {},
  });

  const glView = await prisma.permission.findUnique({ where: { code: PERMISSIONS.GL.VIEW }, select: { id: true } });
  if (glView) {
    await prisma.rolePermission.createMany({
      data: [{ roleId: viewerRole.id, permissionId: glView.id }],
      skipDuplicates: true,
    });
  }

  const superAdminEmail = 'superadmin@uspire.local';
  const sysAdminEmail = 'sysadmin@uspire.local';
  const controllerEmail = 'controller@uspire.local';
  const managerEmail = 'manager@uspire.local';
  const officerEmail = 'officer@uspire.local';

  const rounds = 12;
  const superAdminPasswordHash = await bcrypt.hash('Super123', rounds);
  const sysAdminPasswordHash = await bcrypt.hash('SysAdmin123', rounds);
  const controllerPasswordHash = await bcrypt.hash('Controller123', rounds);
  const managerPasswordHash = await bcrypt.hash('Manager123', rounds);
  const officerPasswordHash = await bcrypt.hash('Officer123', rounds);

  const superAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: superAdminEmail,
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Super Admin',
      email: superAdminEmail,
      passwordHash: superAdminPasswordHash,
      isActive: true,
    },
    update: {
      name: 'Super Admin',
      passwordHash: superAdminPasswordHash,
      isActive: true,
    },
  });

  const sysAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: sysAdminEmail,
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'System Admin',
      email: sysAdminEmail,
      passwordHash: sysAdminPasswordHash,
      isActive: true,
    },
    update: {
      name: 'System Admin',
      passwordHash: sysAdminPasswordHash,
      isActive: true,
    },
  });

  const controllerUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: controllerEmail,
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Finance Controller',
      email: controllerEmail,
      passwordHash: controllerPasswordHash,
      isActive: true,
    },
    update: {
      name: 'Finance Controller',
      passwordHash: controllerPasswordHash,
      isActive: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: managerEmail,
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Finance Manager',
      email: managerEmail,
      passwordHash: managerPasswordHash,
      isActive: true,
    },
    update: {
      name: 'Finance Manager',
      passwordHash: managerPasswordHash,
      isActive: true,
    },
  });

  const officerUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: officerEmail,
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Finance Officer',
      email: officerEmail,
      passwordHash: officerPasswordHash,
      isActive: true,
    },
    update: {
      name: 'Finance Officer',
      passwordHash: officerPasswordHash,
      isActive: true,
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: superAdminUser.id, roleId: superAdminRole.id },
      { userId: sysAdminUser.id, roleId: systemAdminRole.id },
      { userId: controllerUser.id, roleId: financeControllerRole.id },
      { userId: managerUser.id, roleId: financeManagerRole.id },
      { userId: officerUser.id, roleId: financeOfficerRole?.id as string },
    ],
    skipDuplicates: true,
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: superAdminUser.id,
      roleId: { not: superAdminRole.id },
    },
  });
  await prisma.userRole.deleteMany({
    where: {
      userId: sysAdminUser.id,
      roleId: { not: systemAdminRole.id },
    },
  });
  await prisma.userRole.deleteMany({
    where: {
      userId: controllerUser.id,
      roleId: { not: financeControllerRole.id },
    },
  });
  await prisma.userRole.deleteMany({
    where: {
      userId: managerUser.id,
      roleId: { not: financeManagerRole.id },
    },
  });
  await prisma.userRole.deleteMany({
    where: {
      userId: officerUser.id,
      roleId: { not: (financeOfficerRole?.id as string) },
    },
  });

  await prisma.arReminderTemplate.upsert({
    where: {
      tenantId_level: {
        tenantId: tenant.id,
        level: 'NORMAL' as any,
      },
    },
    create: {
      tenantId: tenant.id,
      level: 'NORMAL' as any,
      subject: 'Payment Reminder: Invoice overdue',
      body: 'Dear Customer,\n\nThis is a friendly reminder that you have an overdue invoice. Please arrange payment at your earliest convenience.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
    update: {
      subject: 'Payment Reminder: Invoice overdue',
      body: 'Dear Customer,\n\nThis is a friendly reminder that you have an overdue invoice. Please arrange payment at your earliest convenience.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
  });

  await prisma.arReminderTemplate.upsert({
    where: {
      tenantId_level: {
        tenantId: tenant.id,
        level: 'ESCALATED' as any,
      },
    },
    create: {
      tenantId: tenant.id,
      level: 'ESCALATED' as any,
      subject: 'Second Notice: Overdue Invoice',
      body: 'Dear Customer,\n\nOur records show your invoice remains unpaid. Please settle the outstanding amount as soon as possible to avoid further escalation.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
    update: {
      subject: 'Second Notice: Overdue Invoice',
      body: 'Dear Customer,\n\nOur records show your invoice remains unpaid. Please settle the outstanding amount as soon as possible to avoid further escalation.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
  });

  await prisma.arReminderTemplate.upsert({
    where: {
      tenantId_level: {
        tenantId: tenant.id,
        level: 'FINAL' as any,
      },
    },
    create: {
      tenantId: tenant.id,
      level: 'FINAL' as any,
      subject: 'Final Notice: Immediate Payment Required',
      body: 'Dear Customer,\n\nThis is a final notice that your invoice is significantly overdue. Please make payment immediately or contact us to resolve this matter.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
    update: {
      subject: 'Final Notice: Immediate Payment Required',
      body: 'Dear Customer,\n\nThis is a final notice that your invoice is significantly overdue. Please make payment immediately or contact us to resolve this matter.\n\nRegards,\nFinance Team',
      active: true,
      lastUpdatedById: managerUser.id,
    },
  });

  await prisma.arReminderRule.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Overdue +7 days (NORMAL)',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Overdue +7 days (NORMAL)',
      triggerType: 'AFTER_DUE' as any,
      daysOffset: 7,
      active: true,
      escalationLevel: 'NORMAL' as any,
      createdById: managerUser.id,
    },
    update: {
      triggerType: 'AFTER_DUE' as any,
      daysOffset: 7,
      active: true,
      escalationLevel: 'NORMAL' as any,
    },
  });

  const demoCustomer = await prisma.customer.upsert({
    where: {
      tenantId_customerCode: {
        tenantId: tenant.id,
        customerCode: 'DEMO-AR',
      },
    },
    create: {
      tenantId: tenant.id,
      customerCode: 'DEMO-AR',
      name: 'Demo AR Customer',
      email: 'ar.customer@example.com',
      status: 'ACTIVE' as any,
    },
    update: {
      name: 'Demo AR Customer',
      email: 'ar.customer@example.com',
      status: 'ACTIVE' as any,
    },
  });

  const incomeAccount = await prisma.account.findFirst({
    where: {
      tenantId: tenant.id,
      type: 'INCOME' as any,
      isActive: true,
      isPosting: true,
    },
    select: { id: true },
    orderBy: { code: 'asc' },
  });

  if (incomeAccount?.id) {
    const now = new Date();
    const invoiceDate = new Date(now);
    invoiceDate.setDate(invoiceDate.getDate() - 40);
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() - 35);

    const demoInvoice = await prisma.customerInvoice.upsert({
      where: {
        tenantId_customerId_invoiceNumber: {
          tenantId: tenant.id,
          customerId: demoCustomer.id,
          invoiceNumber: 'INV-DEMO-AR-0001',
        },
      },
      create: {
        tenantId: tenant.id,
        customerId: demoCustomer.id,
        invoiceNumber: 'INV-DEMO-AR-0001',
        invoiceDate,
        dueDate,
        currency: tenant.defaultCurrency ?? 'KES',
        exchangeRate: new Prisma.Decimal('1.0'),
        invoiceType: 'OTHER' as any,
        reference: 'AR Reminder Demo',
        invoiceNote: 'Seeded invoice for AR reminders verification.',
        customerNameSnapshot: demoCustomer.name,
        customerEmailSnapshot: demoCustomer.email,
        customerBillingAddressSnapshot: null,
        subtotal: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        isTaxable: false,
        totalAmount: new Prisma.Decimal('1000.00'),
        status: 'POSTED' as any,
        createdById: managerUser.id,
        postedById: managerUser.id,
        postedAt: new Date(invoiceDate.getTime() + 60 * 60 * 1000),
      } as any,
      update: {
        invoiceDate,
        dueDate,
        currency: tenant.defaultCurrency ?? 'KES',
        exchangeRate: new Prisma.Decimal('1.0'),
        customerNameSnapshot: demoCustomer.name,
        customerEmailSnapshot: demoCustomer.email,
        subtotal: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        isTaxable: false,
        totalAmount: new Prisma.Decimal('1000.00'),
        status: 'POSTED' as any,
        postedById: managerUser.id,
        postedAt: new Date(invoiceDate.getTime() + 60 * 60 * 1000),
      } as any,
    });

    await prisma.customerInvoiceLine.deleteMany({
      where: {
        customerInvoiceId: demoInvoice.id,
      },
    });

    await prisma.customerInvoiceLine.create({
      data: {
        customerInvoiceId: demoInvoice.id,
        accountId: incomeAccount.id,
        description: 'AR Reminder Demo Line',
        quantity: new Prisma.Decimal('1.000000'),
        unitPrice: new Prisma.Decimal('1000.000000'),
        discountTotal: new Prisma.Decimal('0.00'),
        lineTotal: new Prisma.Decimal('1000.00'),
      },
    });
  }

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'FINANCE_GL_POST',
        forbiddenPermissionB: 'FINANCE_GL_APPROVE',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'FINANCE_GL_POST',
      forbiddenPermissionB: 'FINANCE_GL_APPROVE',
      description: 'Finance GL maker vs approver conflict',
    },
    update: {},
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'FINANCE_GL_CREATE',
        forbiddenPermissionB: 'FINANCE_GL_POST',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'FINANCE_GL_CREATE',
      forbiddenPermissionB: 'FINANCE_GL_POST',
      description: 'Finance GL maker vs poster conflict',
    },
    update: {},
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_CREATE',
        forbiddenPermissionB: 'REFUND_APPROVE',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_CREATE',
      forbiddenPermissionB: 'REFUND_APPROVE',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_CREATE',
        forbiddenPermissionB: 'REFUND_POST',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_CREATE',
      forbiddenPermissionB: 'REFUND_POST',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_APPROVE',
        forbiddenPermissionB: 'REFUND_POST',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_APPROVE',
      forbiddenPermissionB: 'REFUND_POST',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_CREATE',
        forbiddenPermissionB: 'REFUND_VOID',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_CREATE',
      forbiddenPermissionB: 'REFUND_VOID',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_APPROVE',
        forbiddenPermissionB: 'REFUND_VOID',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_APPROVE',
      forbiddenPermissionB: 'REFUND_VOID',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'REFUND_POST',
        forbiddenPermissionB: 'REFUND_VOID',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'REFUND_POST',
      forbiddenPermissionB: 'REFUND_VOID',
      description: 'REFUND_LIFECYCLE_SOD',
    },
    update: { description: 'REFUND_LIFECYCLE_SOD' },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'FA_ASSET_CAPITALIZE',
        forbiddenPermissionB: 'FA_DEPRECIATION_RUN',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'FA_ASSET_CAPITALIZE',
      forbiddenPermissionB: 'FA_DEPRECIATION_RUN',
      description: 'Fixed Assets capitalizer vs depreciation runner conflict',
    },
    update: {},
  });

  await prisma.soDRule.deleteMany({
    where: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'FA_DISPOSE',
      forbiddenPermissionB: 'FINANCE_GL_POST',
    },
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'FA_DISPOSE',
        forbiddenPermissionB: 'FA_ASSET_CAPITALIZE',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'FA_DISPOSE',
      forbiddenPermissionB: 'FA_ASSET_CAPITALIZE',
      description: 'Fixed Assets disposer vs capitalizer conflict',
    },
    update: {},
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'forecast.create',
        forbiddenPermissionB: 'forecast.approve',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'forecast.create',
      forbiddenPermissionB: 'forecast.approve',
      description: 'Annual forecast maker vs approver conflict',
    },
    update: {},
  });

  await prisma.soDRule.upsert({
    where: {
      tenantId_forbiddenPermissionA_forbiddenPermissionB: {
        tenantId: tenant.id,
        forbiddenPermissionA: 'forecast.edit',
        forbiddenPermissionB: 'forecast.approve',
      },
    },
    create: {
      tenantId: tenant.id,
      forbiddenPermissionA: 'forecast.edit',
      forbiddenPermissionB: 'forecast.approve',
      description: 'Forecast editor vs approver conflict',
    },
    update: {},
  });

  await seedJournalLineDimensionsMasters();

  // eslint-disable-next-line no-console
  console.log('Seed complete:', { tenantId: tenant.id });
}

main()
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
