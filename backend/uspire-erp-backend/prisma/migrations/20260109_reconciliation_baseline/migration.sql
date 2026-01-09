-- Reconciliation baseline migration
--
-- Generated via: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- Governance: Database resets are forbidden. Forward-only migrations only.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "CustomerInvoiceStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('TRAINING', 'CONSULTING', 'SYSTEMS', 'PUBLISHING', 'DONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReceiptPaymentMethod" AS ENUM ('CASH', 'CARD', 'EFT', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ArReminderTriggerType" AS ENUM ('BEFORE_DUE', 'ON_DUE', 'AFTER_DUE');

-- CreateEnum
CREATE TYPE "ArReminderLevel" AS ENUM ('NORMAL', 'ESCALATED', 'FINAL');

-- CreateEnum
CREATE TYPE "ArReminderTriggerMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RefundPaymentMethod" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SUPPLIER_PAYMENT', 'CUSTOMER_RECEIPT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "PaymentAllocationSourceType" AS ENUM ('SUPPLIER_INVOICE', 'CUSTOMER_INVOICE');

-- CreateEnum
CREATE TYPE "TaxRateType" AS ENUM ('OUTPUT', 'INPUT');

-- CreateEnum
CREATE TYPE "InvoiceTaxSourceType" AS ENUM ('SUPPLIER_INVOICE', 'CUSTOMER_INVOICE');

-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('DRAFT', 'CAPITALIZED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "FixedAssetDepreciationRunStatus" AS ENUM ('POSTED');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'PARKED', 'SUBMITTED', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('STANDARD', 'ADJUSTING', 'ACCRUAL', 'REVERSING');

-- CreateEnum
CREATE TYPE "RecurringJournalFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'SOFT_CLOSED');

-- CreateEnum
CREATE TYPE "AccountingPeriodType" AS ENUM ('OPENING', 'NORMAL');

-- CreateEnum
CREATE TYPE "PeriodCloseChecklistItemStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('JOURNAL_POST', 'PERIOD_CHECKLIST_COMPLETE', 'PERIOD_CLOSE', 'SOD_VIOLATION', 'AP_POST', 'AR_POST', 'FA_CAPITALIZE', 'FA_DEPRECIATION_RUN', 'FA_DISPOSE', 'BANK_RECONCILIATION_MATCH', 'EVIDENCE_UPLOAD', 'BUDGET_CREATE', 'BUDGET_APPROVE', 'REPORT_VIEW', 'REPORT_EXPORT', 'FORECAST_CREATE', 'FORECAST_UPDATE', 'FORECAST_SUBMIT', 'FORECAST_APPROVE', 'FORECAST_SUPERSEDE', 'FORECAST_VIEW', 'DASHBOARD_VIEW', 'ORGANISATION_UPDATE', 'ORGANISATION_LOGO_UPLOAD', 'USER_CREATE', 'USER_STATUS_CHANGE', 'USER_ROLE_ASSIGN', 'COA_CREATE', 'COA_UPDATE', 'COA_DEACTIVATE', 'COA_FREEZE', 'COA_UNFREEZE', 'COA_HIERARCHY_CHANGE', 'COA_LOCKED', 'COA_UNLOCKED', 'JOURNAL_CREATE', 'JOURNAL_UPDATE', 'JOURNAL_PARK', 'JOURNAL_REVERSE', 'RECURRING_TEMPLATE_CREATE', 'RECURRING_TEMPLATE_UPDATE', 'RECURRING_JOURNAL_GENERATED', 'JOURNAL_UPLOAD', 'JOURNAL_UPLOAD_FAILED', 'PERIOD_REOPEN', 'DISCLOSURE_NOTE_GENERATE', 'DISCLOSURE_NOTE_VIEW', 'GL_JOURNAL_SUBMITTED', 'GL_JOURNAL_REVIEWED', 'GL_JOURNAL_POSTED', 'GL_JOURNAL_REVERSED', 'GL_JOURNAL_POST_BLOCKED', 'FA_POST', 'GL_JOURNAL_REJECTED', 'GL_JOURNAL_RETURNED_BY_POSTER', 'GL_JOURNAL_REVERSAL_INITIATED', 'GL_JOURNAL_REVERSAL_APPROVED', 'GL_JOURNAL_REVERSAL_POSTED', 'GL_JOURNAL_REVERSAL_ASSIGNED', 'GL_JOURNAL_RISK_COMPUTED', 'GL_JOURNAL_BUDGET_EVALUATED', 'COA_IMPORTED', 'COA_CLEANUP_EXECUTED', 'PERIOD_CREATED', 'PERIOD_REOPENED', 'PERIOD_CLOSED', 'DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_CLOSED', 'FUND_CREATED', 'FUND_UPDATED', 'INVOICE_CATEGORY_CREATED', 'INVOICE_CATEGORY_UPDATED', 'INVOICE_CATEGORY_STATUS_CHANGE', 'TAX_RATE_CREATED', 'TAX_RATE_UPDATED', 'TAX_RATE_STATUS_CHANGE', 'TAX_CONFIG_UPDATED', 'PERIOD_CORRECTION', 'PERIOD_CORRECTED', 'AR_REMINDER_SENT', 'AR_REMINDER_CONFIG_CHANGED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "BudgetControlMode" AS ENUM ('WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "JournalBudgetStatus" AS ENUM ('OK', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('JOURNAL_ENTRY', 'ACCOUNTING_PERIOD', 'ACCOUNTING_PERIOD_CHECKLIST_ITEM', 'SUPPLIER_INVOICE', 'CUSTOMER_INVOICE', 'FIXED_ASSET', 'FIXED_ASSET_DEPRECIATION_RUN', 'BANK_RECONCILIATION_MATCH', 'USER', 'BUDGET', 'REPORT', 'FORECAST', 'TENANT', 'ACCOUNT', 'RECURRING_JOURNAL_TEMPLATE', 'DISCLOSURE_NOTE', 'CHART_OF_ACCOUNTS', 'CUSTOMER_RECEIPT', 'INVOICE_CATEGORY', 'TAX_RATE', 'TENANT_TAX_CONFIG', 'DEPARTMENT', 'PROJECT', 'FUND');

-- CreateEnum
CREATE TYPE "DisclosureNoteType" AS ENUM ('PPE_MOVEMENT', 'DEPRECIATION', 'TAX_RECONCILIATION', 'PROVISIONS', 'CONTINGENCIES');

-- CreateTable
CREATE TABLE "TenantSequenceCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "defaultUsefulLifeMonths" INTEGER NOT NULL,
    "defaultResidualRate" DECIMAL(7,4),
    "assetAccountId" TEXT NOT NULL,
    "accumDepAccountId" TEXT NOT NULL,
    "depExpenseAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "capitalizationDate" TIMESTAMP(3),
    "cost" DECIMAL(18,2) NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "assetAccountId" TEXT,
    "accumDepAccountId" TEXT,
    "depExpenseAccountId" TEXT,
    "vendorId" TEXT,
    "apInvoiceId" TEXT,
    "capitalizationJournalId" TEXT,
    "disposalJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT NOT NULL,
    "status" "FixedAssetDepreciationRunStatus" NOT NULL DEFAULT 'POSTED',
    "journalEntryId" TEXT,

    CONSTRAINT "FixedAssetDepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciationLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAssetDepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revenueAccountId" TEXT NOT NULL,
    "requiresProject" BOOLEAN NOT NULL DEFAULT false,
    "requiresFund" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InvoiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArReminderRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "ArReminderTriggerType" NOT NULL,
    "daysOffset" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "escalationLevel" "ArReminderLevel" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArReminderTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "level" "ArReminderLevel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdatedById" TEXT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArReminderTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArReminderLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reminderRuleId" TEXT,
    "reminderLevel" "ArReminderLevel" NOT NULL,
    "triggerMode" "ArReminderTriggerMode" NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantTaxConfig" (
    "tenantId" TEXT NOT NULL,
    "outputVatAccountId" TEXT,
    "inputVatAccountId" TEXT,

    CONSTRAINT "TenantTaxConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "type" "TaxRateType" NOT NULL,
    "glAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "bankStatementId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "statementLineId" TEXT NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL,
    "reconciledBy" TEXT NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTaxLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "InvoiceTaxSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "sourceType" "PaymentAllocationSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingAddress" TEXT,
    "customerCode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactPerson" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "customerBillingAddressSnapshot" TEXT,
    "customerEmailSnapshot" TEXT,
    "customerNameSnapshot" TEXT NOT NULL DEFAULT '',
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "invoiceNote" TEXT,
    "invoiceCategoryId" TEXT,
    "fundId" TEXT,
    "departmentId" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "invoiceType" "InvoiceType",
    "projectId" TEXT,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "postedJournalId" TEXT,
    "taxAmount" DECIMAL(15,2),
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "lineAmount" DECIMAL(18,2) NOT NULL,
    "revenueAccountId" TEXT NOT NULL,
    "departmentId" TEXT,
    "projectId" TEXT,
    "fundId" TEXT,

    CONSTRAINT "CustomerCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiptId" TEXT,
    "creditNoteId" TEXT,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "RefundPaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "voidedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "postedJournalId" TEXT,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriodChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriodChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "checklistCode" TEXT NOT NULL,
    "checklistName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriodCloseLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT,
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodCloseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "permissionUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastId" TEXT,
    "forecastVersionId" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastVersion" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastLine" (
    "id" TEXT NOT NULL,
    "forecastVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ForecastLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "zipSize" INTEGER NOT NULL,
    "zipSha256Hash" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoiceLine" (
    "id" TEXT NOT NULL,
    "customerInvoiceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "discountAmount" DECIMAL(18,2),
    "discountPercent" DECIMAL(18,6),
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "departmentId" TEXT,
    "fundId" TEXT,
    "projectId" TEXT,
    "taxRateId" TEXT,

    CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoiceImportLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,

    CONSTRAINT "CustomerInvoiceImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" "ReceiptPaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "glJournalId" TEXT,
    "postedByUserId" TEXT,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "appliedAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "CustomerReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoUrl" TEXT,
    "organisationName" TEXT NOT NULL DEFAULT 'USPIRE ERP',
    "organisationShortName" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#020445',
    "secondaryColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accentColor" TEXT,
    "country" TEXT,
    "dateFormat" TEXT,
    "defaultCurrency" TEXT,
    "defaultDashboard" TEXT,
    "defaultLandingPage" TEXT,
    "defaultLanguage" TEXT,
    "defaultUserRoleCode" TEXT,
    "demoModeEnabled" BOOLEAN DEFAULT false,
    "faviconUrl" TEXT,
    "financialYearStartMonth" INTEGER,
    "legalName" TEXT,
    "numberFormat" TEXT,
    "secondaryAccentColor" TEXT,
    "timezone" TEXT,
    "coaFrozen" BOOLEAN NOT NULL DEFAULT false,
    "coaLockedAt" TIMESTAMP(3),
    "arControlAccountId" TEXT,
    "defaultBankClearingAccountId" TEXT,
    "unappliedReceiptsAccountId" TEXT,
    "allowSelfPosting" BOOLEAN NOT NULL DEFAULT false,
    "receiptBankName" TEXT,
    "receiptBankAccountName" TEXT,
    "receiptBankAccountNumber" TEXT,
    "receiptBankBranch" TEXT,
    "receiptBankSwiftCode" TEXT,
    "requiresDepartmentOnInvoices" BOOLEAN NOT NULL DEFAULT false,
    "requiresFundOnInvoices" BOOLEAN NOT NULL DEFAULT false,
    "requiresProjectOnInvoices" BOOLEAN NOT NULL DEFAULT false,
    "cashClearingAccountId" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "fiscalYearStart" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "SoDRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "forbiddenPermissionA" TEXT NOT NULL,
    "forbiddenPermissionB" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoDRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoDViolationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionAttempted" TEXT NOT NULL,
    "conflictingPermission" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoDViolationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCashEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "ifrsMappingCode" TEXT,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "isPosting" BOOLEAN NOT NULL DEFAULT true,
    "parentAccountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hierarchyPath" TEXT,
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "isPostingAllowed" BOOLEAN NOT NULL DEFAULT true,
    "normalBalance" "NormalBalance" NOT NULL DEFAULT 'DEBIT',
    "requiresFund" BOOLEAN NOT NULL DEFAULT false,
    "requiresProject" BOOLEAN NOT NULL DEFAULT false,
    "budgetControlMode" "BudgetControlMode" NOT NULL DEFAULT 'WARN',
    "isBudgetRelevant" BOOLEAN NOT NULL DEFAULT false,
    "fsMappingLevel1" TEXT,
    "fsMappingLevel2" TEXT,
    "subCategory" TEXT,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaCanonicalSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "fileName" TEXT,
    "format" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "hash" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "CoaCanonicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "journalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "journalNumber" INTEGER,
    "journalType" "JournalType" NOT NULL DEFAULT 'STANDARD',
    "periodId" TEXT,
    "reversalOfId" TEXT,
    "reviewedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "returnReason" TEXT,
    "returnedByPosterAt" TIMESTAMP(3),
    "returnedByPosterId" TEXT,
    "reversalInitiatedAt" TIMESTAMP(3),
    "reversalInitiatedById" TEXT,
    "reversalReason" TEXT,
    "reversalPreparedById" TEXT,
    "correctsJournalId" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" JSONB NOT NULL DEFAULT '[]',
    "riskComputedAt" TIMESTAMP(3),
    "budgetCheckedAt" TIMESTAMP(3),
    "budgetFlags" JSONB,
    "budgetOverrideJustification" TEXT,
    "budgetStatus" "JournalBudgetStatus" NOT NULL DEFAULT 'OK',
    "sourceType" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringJournalTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "journalType" "JournalType" NOT NULL DEFAULT 'STANDARD',
    "referenceTemplate" TEXT NOT NULL,
    "descriptionTemplate" TEXT,
    "frequency" "RecurringJournalFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringJournalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringJournalTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "descriptionTemplate" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL,
    "creditAmount" DECIMAL(18,2) NOT NULL,
    "lineOrder" INTEGER NOT NULL,

    CONSTRAINT "RecurringJournalTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringJournalGeneration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "generatedJournalId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringJournalGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT,
    "createdById" TEXT,
    "type" "AccountingPeriodType" NOT NULL DEFAULT 'NORMAL',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriodCorrection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "oldStartDate" TIMESTAMP(3) NOT NULL,
    "oldEndDate" TIMESTAMP(3) NOT NULL,
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "noteType" "DisclosureNoteType" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisclosureNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureNoteLine" (
    "id" TEXT NOT NULL,
    "disclosureNoteId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "DisclosureNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodCloseChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodCloseChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodCloseChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PeriodCloseChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodCloseChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "lineNumber" INTEGER,
    "departmentId" TEXT,
    "legalEntityId" TEXT,
    "fundId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "BudgetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    "fundId" TEXT,
    "legalEntityId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantSequenceCounter_tenantId_idx" ON "TenantSequenceCounter"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSequenceCounter_tenantId_name_key" ON "TenantSequenceCounter"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FixedAssetCategory_tenantId_idx" ON "FixedAssetCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetCategory_tenantId_code_key" ON "FixedAssetCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_idx" ON "FixedAsset"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_status_idx" ON "FixedAsset"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_createdById_idx" ON "FixedAsset"("createdById");

-- CreateIndex
CREATE INDEX "FixedAsset_categoryId_idx" ON "FixedAsset"("categoryId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationRun_tenantId_idx" ON "FixedAssetDepreciationRun"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationRun_periodId_idx" ON "FixedAssetDepreciationRun"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciationRun_tenantId_periodId_key" ON "FixedAssetDepreciationRun"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_tenantId_idx" ON "FixedAssetDepreciationLine"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_runId_idx" ON "FixedAssetDepreciationLine"("runId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_assetId_idx" ON "FixedAssetDepreciationLine"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciationLine_tenantId_runId_assetId_key" ON "FixedAssetDepreciationLine"("tenantId", "runId", "assetId");

-- CreateIndex
CREATE INDEX "InvoiceCategory_tenantId_idx" ON "InvoiceCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCategory_tenantId_code_key" ON "InvoiceCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ArReminderRule_tenantId_idx" ON "ArReminderRule"("tenantId");

-- CreateIndex
CREATE INDEX "ArReminderRule_tenantId_active_idx" ON "ArReminderRule"("tenantId", "active");

-- CreateIndex
CREATE INDEX "ArReminderRule_tenantId_triggerType_idx" ON "ArReminderRule"("tenantId", "triggerType");

-- CreateIndex
CREATE INDEX "ArReminderRule_createdById_idx" ON "ArReminderRule"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ArReminderRule_tenantId_name_key" ON "ArReminderRule"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ArReminderTemplate_tenantId_idx" ON "ArReminderTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ArReminderTemplate_tenantId_active_idx" ON "ArReminderTemplate"("tenantId", "active");

-- CreateIndex
CREATE INDEX "ArReminderTemplate_lastUpdatedById_idx" ON "ArReminderTemplate"("lastUpdatedById");

-- CreateIndex
CREATE UNIQUE INDEX "ArReminderTemplate_tenantId_level_key" ON "ArReminderTemplate"("tenantId", "level");

-- CreateIndex
CREATE INDEX "ArReminderLog_tenantId_idx" ON "ArReminderLog"("tenantId");

-- CreateIndex
CREATE INDEX "ArReminderLog_tenantId_sentAt_idx" ON "ArReminderLog"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "ArReminderLog_tenantId_customerId_idx" ON "ArReminderLog"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "ArReminderLog_tenantId_invoiceId_idx" ON "ArReminderLog"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "ArReminderLog_sentById_idx" ON "ArReminderLog"("sentById");

-- CreateIndex
CREATE INDEX "TenantTaxConfig_outputVatAccountId_idx" ON "TenantTaxConfig"("outputVatAccountId");

-- CreateIndex
CREATE INDEX "TenantTaxConfig_inputVatAccountId_idx" ON "TenantTaxConfig"("inputVatAccountId");

-- CreateIndex
CREATE INDEX "TaxRate_tenantId_idx" ON "TaxRate"("tenantId");

-- CreateIndex
CREATE INDEX "TaxRate_glAccountId_idx" ON "TaxRate"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_tenantId_name_key" ON "TaxRate"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_tenantId_code_key" ON "TaxRate"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_idx" ON "BankStatement"("tenantId");

-- CreateIndex
CREATE INDEX "BankStatement_bankAccountId_idx" ON "BankStatement"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_tenantId_bankAccountId_statementDate_key" ON "BankStatement"("tenantId", "bankAccountId", "statementDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_bankStatementId_idx" ON "BankStatementLine"("bankStatementId");

-- CreateIndex
CREATE INDEX "BankStatementLine_transactionDate_idx" ON "BankStatementLine"("transactionDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_isReconciled_idx" ON "BankStatementLine"("isReconciled");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_paymentId_key" ON "BankReconciliation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_statementLineId_key" ON "BankReconciliation"("statementLineId");

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_idx" ON "BankReconciliation"("tenantId");

-- CreateIndex
CREATE INDEX "BankReconciliation_bankAccountId_idx" ON "BankReconciliation"("bankAccountId");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_tenantId_idx" ON "InvoiceTaxLine"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_sourceType_sourceId_idx" ON "InvoiceTaxLine"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_taxRateId_idx" ON "InvoiceTaxLine"("taxRateId");

-- CreateIndex
CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount"("tenantId");

-- CreateIndex
CREATE INDEX "BankAccount_glAccountId_idx" ON "BankAccount"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_tenantId_name_key" ON "BankAccount"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_bankAccountId_idx" ON "Payment"("bankAccountId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_sourceType_sourceId_idx" ON "PaymentAllocation"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_customerCode_key" ON "Customer"("tenantId", "customerCode");

-- CreateIndex
CREATE INDEX "CustomerInvoice_tenantId_idx" ON "CustomerInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_tenantId_status_idx" ON "CustomerInvoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustomerInvoice_invoiceCategoryId_idx" ON "CustomerInvoice"("invoiceCategoryId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_projectId_idx" ON "CustomerInvoice"("projectId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_fundId_idx" ON "CustomerInvoice"("fundId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_departmentId_idx" ON "CustomerInvoice"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_tenantId_customerId_invoiceNumber_key" ON "CustomerInvoice"("tenantId", "customerId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_creditNoteNumber_idx" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_customerId_idx" ON "CustomerCreditNote"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_invoiceId_idx" ON "CustomerCreditNote"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_status_idx" ON "CustomerCreditNote"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditNote_tenantId_creditNoteNumber_key" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditNote_tenantId_postedJournalId_key" ON "CustomerCreditNote"("tenantId", "postedJournalId");

-- CreateIndex
CREATE INDEX "CustomerCreditNoteLine_creditNoteId_idx" ON "CustomerCreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE INDEX "CustomerRefund_tenantId_refundNumber_idx" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX "CustomerRefund_tenantId_customerId_idx" ON "CustomerRefund"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerRefund_tenantId_creditNoteId_idx" ON "CustomerRefund"("tenantId", "creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_tenantId_refundNumber_key" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_tenantId_postedJournalId_key" ON "CustomerRefund"("tenantId", "postedJournalId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_tenantId_idx" ON "AccountingPeriodChecklistItem"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_periodId_idx" ON "AccountingPeriodChecklistItem"("periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_completedById_idx" ON "AccountingPeriodChecklistItem"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriodChecklistItem_tenantId_periodId_code_key" ON "AccountingPeriodChecklistItem"("tenantId", "periodId", "code");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklist_tenantId_idx" ON "AccountingPeriodChecklist"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklist_periodId_idx" ON "AccountingPeriodChecklist"("periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklist_completedById_idx" ON "AccountingPeriodChecklist"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriodChecklist_tenantId_periodId_checklistCode_key" ON "AccountingPeriodChecklist"("tenantId", "periodId", "checklistCode");

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_tenantId_idx" ON "AccountingPeriodCloseLog"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_periodId_idx" ON "AccountingPeriodCloseLog"("periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_userId_idx" ON "AccountingPeriodCloseLog"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_userId_idx" ON "AuditEvent"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_forecastId_idx" ON "AuditEvent"("tenantId", "forecastId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_forecastVersionId_idx" ON "AuditEvent"("tenantId", "forecastVersionId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_eventType_createdAt_idx" ON "AuditEvent"("tenantId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Forecast_tenantId_idx" ON "Forecast"("tenantId");

-- CreateIndex
CREATE INDEX "Forecast_tenantId_fiscalYear_idx" ON "Forecast"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "Forecast_createdById_idx" ON "Forecast"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_tenantId_fiscalYear_key" ON "Forecast"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ForecastVersion_forecastId_idx" ON "ForecastVersion"("forecastId");

-- CreateIndex
CREATE INDEX "ForecastVersion_createdById_idx" ON "ForecastVersion"("createdById");

-- CreateIndex
CREATE INDEX "ForecastVersion_forecastId_status_idx" ON "ForecastVersion"("forecastId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastVersion_forecastId_versionNumber_key" ON "ForecastVersion"("forecastId", "versionNumber");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_idx" ON "ForecastLine"("forecastVersionId");

-- CreateIndex
CREATE INDEX "ForecastLine_accountId_idx" ON "ForecastLine"("accountId");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_month_idx" ON "ForecastLine"("forecastVersionId", "month");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_accountId_month_idx" ON "ForecastLine"("forecastVersionId", "accountId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastLine_forecastVersionId_accountId_month_key" ON "ForecastLine"("forecastVersionId", "accountId", "month");

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_idx" ON "AuditEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_entityType_entityId_idx" ON "AuditEvidence"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvidence_uploadedById_idx" ON "AuditEvidence"("uploadedById");

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_createdAt_idx" ON "AuditEvidence"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvidence_tenantId_storageKey_key" ON "AuditEvidence"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_idx" ON "ReviewPack"("tenantId");

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_periodId_idx" ON "ReviewPack"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_createdAt_idx" ON "ReviewPack"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewPack_tenantId_storageKey_key" ON "ReviewPack"("tenantId", "storageKey");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_customerInvoiceId_idx" ON "CustomerInvoiceLine"("customerInvoiceId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_accountId_idx" ON "CustomerInvoiceLine"("accountId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_taxRateId_idx" ON "CustomerInvoiceLine"("taxRateId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_departmentId_idx" ON "CustomerInvoiceLine"("departmentId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_projectId_idx" ON "CustomerInvoiceLine"("projectId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_fundId_idx" ON "CustomerInvoiceLine"("fundId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_tenantId_idx" ON "CustomerInvoiceImportLog"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_tenantId_processedAt_idx" ON "CustomerInvoiceImportLog"("tenantId", "processedAt");

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_processedById_idx" ON "CustomerInvoiceImportLog"("processedById");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoiceImportLog_tenantId_importId_key" ON "CustomerInvoiceImportLog"("tenantId", "importId");

-- CreateIndex
CREATE INDEX "CustomerReceipt_tenantId_idx" ON "CustomerReceipt"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerReceipt_tenantId_status_idx" ON "CustomerReceipt"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustomerReceipt_customerId_idx" ON "CustomerReceipt"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_tenantId_receiptNumber_key" ON "CustomerReceipt"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "CustomerReceiptLine_receiptId_idx" ON "CustomerReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "CustomerReceiptLine_invoiceId_idx" ON "CustomerReceiptLine"("invoiceId");

-- CreateIndex
CREATE INDEX "CustomerReceiptLine_tenantId_idx" ON "CustomerReceiptLine"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceiptLine_receiptId_invoiceId_key" ON "CustomerReceiptLine"("receiptId", "invoiceId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "SupplierInvoice_tenantId_idx" ON "SupplierInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_tenantId_status_idx" ON "SupplierInvoice"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_tenantId_supplierId_invoiceNumber_key" ON "SupplierInvoice"("tenantId", "supplierId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_supplierInvoiceId_idx" ON "SupplierInvoiceLine"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_accountId_idx" ON "SupplierInvoiceLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Entity_tenantId_idx" ON "Entity"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_tenantId_name_key" ON "Entity"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_idx" ON "LegalEntity"("tenantId");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_isActive_idx" ON "LegalEntity"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_effectiveFrom_idx" ON "LegalEntity"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_effectiveTo_idx" ON "LegalEntity"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "LegalEntity_createdById_idx" ON "LegalEntity"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_tenantId_code_key" ON "LegalEntity"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Project_tenantId_isActive_idx" ON "Project"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Project_tenantId_isRestricted_idx" ON "Project"("tenantId", "isRestricted");

-- CreateIndex
CREATE INDEX "Project_tenantId_effectiveFrom_idx" ON "Project"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Project_tenantId_effectiveTo_idx" ON "Project"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_code_key" ON "Project"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Fund_tenantId_idx" ON "Fund"("tenantId");

-- CreateIndex
CREATE INDEX "Fund_tenantId_status_idx" ON "Fund"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Fund_tenantId_projectId_idx" ON "Fund"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Fund_tenantId_isActive_idx" ON "Fund"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Fund_tenantId_effectiveFrom_idx" ON "Fund"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Fund_tenantId_effectiveTo_idx" ON "Fund"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Fund_createdById_idx" ON "Fund"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_tenantId_code_key" ON "Fund"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Department_tenantId_effectiveFrom_idx" ON "Department"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Department_tenantId_effectiveTo_idx" ON "Department"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Department_createdById_idx" ON "Department"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "SoDRule_tenantId_idx" ON "SoDRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SoDRule_tenantId_forbiddenPermissionA_forbiddenPermissionB_key" ON "SoDRule"("tenantId", "forbiddenPermissionA", "forbiddenPermissionB");

-- CreateIndex
CREATE INDEX "SoDViolationLog_tenantId_idx" ON "SoDViolationLog"("tenantId");

-- CreateIndex
CREATE INDEX "SoDViolationLog_userId_idx" ON "SoDViolationLog"("userId");

-- CreateIndex
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");

-- CreateIndex
CREATE INDEX "Account_tenantId_parentAccountId_idx" ON "Account"("tenantId", "parentAccountId");

-- CreateIndex
CREATE INDEX "Account_createdById_idx" ON "Account"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Account_tenantId_code_key" ON "Account"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CoaCanonicalSnapshot_tenantId_idx" ON "CoaCanonicalSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "CoaCanonicalSnapshot_uploadedAt_idx" ON "CoaCanonicalSnapshot"("uploadedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_idx" ON "JournalEntry"("tenantId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_journalType_idx" ON "JournalEntry"("tenantId", "journalType");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_periodId_idx" ON "JournalEntry"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_idx" ON "JournalEntry"("tenantId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_journalDate_idx" ON "JournalEntry"("tenantId", "status", "journalDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_sourceType_sourceId_idx" ON "JournalEntry"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_journalNumber_key" ON "JournalEntry"("tenantId", "journalNumber");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_idx" ON "RecurringJournalTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_isActive_idx" ON "RecurringJournalTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_nextRunDate_idx" ON "RecurringJournalTemplate"("tenantId", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_createdById_idx" ON "RecurringJournalTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalTemplate_tenantId_name_key" ON "RecurringJournalTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplateLine_templateId_idx" ON "RecurringJournalTemplateLine"("templateId");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplateLine_accountId_idx" ON "RecurringJournalTemplateLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalTemplateLine_templateId_lineOrder_key" ON "RecurringJournalTemplateLine"("templateId", "lineOrder");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_tenantId_idx" ON "RecurringJournalGeneration"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_tenantId_templateId_idx" ON "RecurringJournalGeneration"("tenantId", "templateId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_generatedJournalId_idx" ON "RecurringJournalGeneration"("generatedJournalId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_generatedById_idx" ON "RecurringJournalGeneration"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalGeneration_tenantId_templateId_runDate_key" ON "RecurringJournalGeneration"("tenantId", "templateId", "runDate");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_type_idx" ON "AccountingPeriod"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_status_idx" ON "AccountingPeriod"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_startDate_endDate_idx" ON "AccountingPeriod"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AccountingPeriod_createdById_idx" ON "AccountingPeriod"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_code_key" ON "AccountingPeriod"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AccountingPeriodCorrection_tenantId_idx" ON "AccountingPeriodCorrection"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCorrection_tenantId_periodId_idx" ON "AccountingPeriodCorrection"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCorrection_correctedBy_idx" ON "AccountingPeriodCorrection"("correctedBy");

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_idx" ON "DisclosureNote"("tenantId");

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_accountingPeriodId_idx" ON "DisclosureNote"("tenantId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_noteType_idx" ON "DisclosureNote"("tenantId", "noteType");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNote_tenantId_accountingPeriodId_noteType_key" ON "DisclosureNote"("tenantId", "accountingPeriodId", "noteType");

-- CreateIndex
CREATE INDEX "DisclosureNoteLine_disclosureNoteId_idx" ON "DisclosureNoteLine"("disclosureNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNoteLine_disclosureNoteId_rowKey_key" ON "DisclosureNoteLine"("disclosureNoteId", "rowKey");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNoteLine_disclosureNoteId_orderIndex_key" ON "DisclosureNoteLine"("disclosureNoteId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklist_periodId_key" ON "PeriodCloseChecklist"("periodId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklist_tenantId_idx" ON "PeriodCloseChecklist"("tenantId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklist_periodId_idx" ON "PeriodCloseChecklist"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklist_tenantId_periodId_key" ON "PeriodCloseChecklist"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_tenantId_idx" ON "PeriodCloseChecklistItem"("tenantId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_checklistId_idx" ON "PeriodCloseChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_completedById_idx" ON "PeriodCloseChecklistItem"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklistItem_checklistId_code_key" ON "PeriodCloseChecklistItem"("checklistId", "code");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_legalEntityId_idx" ON "JournalLine"("legalEntityId");

-- CreateIndex
CREATE INDEX "JournalLine_departmentId_idx" ON "JournalLine"("departmentId");

-- CreateIndex
CREATE INDEX "JournalLine_projectId_idx" ON "JournalLine"("projectId");

-- CreateIndex
CREATE INDEX "JournalLine_fundId_idx" ON "JournalLine"("fundId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_lineNumber_idx" ON "JournalLine"("journalEntryId", "lineNumber");

-- CreateIndex
CREATE INDEX "Budget_tenantId_idx" ON "Budget"("tenantId");

-- CreateIndex
CREATE INDEX "Budget_tenantId_fiscalYear_idx" ON "Budget"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "BudgetRevision_tenantId_idx" ON "BudgetRevision"("tenantId");

-- CreateIndex
CREATE INDEX "BudgetRevision_tenantId_budgetId_idx" ON "BudgetRevision"("tenantId", "budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRevision_budgetId_revisionNo_key" ON "BudgetRevision"("budgetId", "revisionNo");

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_idx" ON "BudgetLine"("tenantId");

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_budgetId_idx" ON "BudgetLine"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_accountId_idx" ON "BudgetLine"("accountId");

-- CreateIndex
CREATE INDEX "BudgetLine_periodId_idx" ON "BudgetLine"("periodId");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_accountId_idx" ON "BudgetLine"("budgetId", "accountId");

-- CreateIndex
CREATE INDEX "BudgetLine_legalEntityId_idx" ON "BudgetLine"("legalEntityId");

-- CreateIndex
CREATE INDEX "BudgetLine_departmentId_idx" ON "BudgetLine"("departmentId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_idx" ON "BudgetLine"("projectId");

-- CreateIndex
CREATE INDEX "BudgetLine_fundId_idx" ON "BudgetLine"("fundId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_revisionId_accountId_periodId_legalEntityId_depa_key" ON "BudgetLine"("revisionId", "accountId", "periodId", "legalEntityId", "departmentId", "projectId", "fundId");

-- AddForeignKey
ALTER TABLE "TenantSequenceCounter" ADD CONSTRAINT "TenantSequenceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_accumDepAccountId_fkey" FOREIGN KEY ("accumDepAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_depExpenseAccountId_fkey" FOREIGN KEY ("depExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_accumDepAccountId_fkey" FOREIGN KEY ("accumDepAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_apInvoiceId_fkey" FOREIGN KEY ("apInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_capitalizationJournalId_fkey" FOREIGN KEY ("capitalizationJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FixedAssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_depExpenseAccountId_fkey" FOREIGN KEY ("depExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_disposalJournalId_fkey" FOREIGN KEY ("disposalJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FixedAssetDepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCategory" ADD CONSTRAINT "InvoiceCategory_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCategory" ADD CONSTRAINT "InvoiceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderRule" ADD CONSTRAINT "ArReminderRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderRule" ADD CONSTRAINT "ArReminderRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderTemplate" ADD CONSTRAINT "ArReminderTemplate_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderTemplate" ADD CONSTRAINT "ArReminderTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderLog" ADD CONSTRAINT "ArReminderLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderLog" ADD CONSTRAINT "ArReminderLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderLog" ADD CONSTRAINT "ArReminderLog_reminderRuleId_fkey" FOREIGN KEY ("reminderRuleId") REFERENCES "ArReminderRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderLog" ADD CONSTRAINT "ArReminderLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArReminderLog" ADD CONSTRAINT "ArReminderLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_inputVatAccountId_fkey" FOREIGN KEY ("inputVatAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_outputVatAccountId_fkey" FOREIGN KEY ("outputVatAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_bankStatementId_fkey" FOREIGN KEY ("bankStatementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "BankStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_invoiceCategoryId_fkey" FOREIGN KEY ("invoiceCategoryId") REFERENCES "InvoiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_postedJournalId_fkey" FOREIGN KEY ("postedJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CustomerCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CustomerCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_postedJournalId_fkey" FOREIGN KEY ("postedJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastVersion" ADD CONSTRAINT "ForecastVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastVersion" ADD CONSTRAINT "ForecastVersion_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_forecastVersionId_fkey" FOREIGN KEY ("forecastVersionId") REFERENCES "ForecastVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvidence" ADD CONSTRAINT "AuditEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvidence" ADD CONSTRAINT "AuditEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_customerInvoiceId_fkey" FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceImportLog" ADD CONSTRAINT "CustomerInvoiceImportLog_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceImportLog" ADD CONSTRAINT "CustomerInvoiceImportLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_glJournalId_fkey" FOREIGN KEY ("glJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_arControlAccountId_fkey" FOREIGN KEY ("arControlAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_cashClearingAccountId_fkey" FOREIGN KEY ("cashClearingAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_defaultBankClearingAccountId_fkey" FOREIGN KEY ("defaultBankClearingAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_unappliedReceiptsAccountId_fkey" FOREIGN KEY ("unappliedReceiptsAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDRule" ADD CONSTRAINT "SoDRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDViolationLog" ADD CONSTRAINT "SoDViolationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDViolationLog" ADD CONSTRAINT "SoDViolationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaCanonicalSnapshot" ADD CONSTRAINT "CoaCanonicalSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaCanonicalSnapshot" ADD CONSTRAINT "CoaCanonicalSnapshot_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_correctsJournalId_fkey" FOREIGN KEY ("correctsJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_returnedByPosterId_fkey" FOREIGN KEY ("returnedByPosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalInitiatedById_fkey" FOREIGN KEY ("reversalInitiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalPreparedById_fkey" FOREIGN KEY ("reversalPreparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplate" ADD CONSTRAINT "RecurringJournalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplate" ADD CONSTRAINT "RecurringJournalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplateLine" ADD CONSTRAINT "RecurringJournalTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplateLine" ADD CONSTRAINT "RecurringJournalTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringJournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_generatedJournalId_fkey" FOREIGN KEY ("generatedJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringJournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCorrection" ADD CONSTRAINT "AccountingPeriodCorrection_correctedBy_fkey" FOREIGN KEY ("correctedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCorrection" ADD CONSTRAINT "AccountingPeriodCorrection_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCorrection" ADD CONSTRAINT "AccountingPeriodCorrection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNoteLine" ADD CONSTRAINT "DisclosureNoteLine_disclosureNoteId_fkey" FOREIGN KEY ("disclosureNoteId") REFERENCES "DisclosureNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklist" ADD CONSTRAINT "PeriodCloseChecklist_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklist" ADD CONSTRAINT "PeriodCloseChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "PeriodCloseChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "BudgetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
