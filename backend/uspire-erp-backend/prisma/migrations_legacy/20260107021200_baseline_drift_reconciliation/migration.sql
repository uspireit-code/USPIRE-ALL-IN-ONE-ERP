DO $$ BEGIN
  CREATE TYPE "public"."CustomerCreditNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."InvoiceType" AS ENUM ('TRAINING', 'CONSULTING', 'SYSTEMS', 'PUBLISHING', 'DONATION', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."RefundStatus" AS ENUM ('DRAFT', 'POSTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'INVOICE_CATEGORY'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'TAX_RATE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'TENANT_TAX_CONFIG'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'DEPARTMENT'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'PROJECT'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEntityType" ADD VALUE 'FUND'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'DEPARTMENT_CREATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'DEPARTMENT_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_CREATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_CLOSED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'FUND_CREATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'FUND_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_CREATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_STATUS_CHANGE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_CREATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_STATUS_CHANGE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_CONFIG_UPDATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable
ALTER TABLE "public"."CustomerInvoice" ADD COLUMN     "invoiceType" "public"."InvoiceType",
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "public"."Department" ADD COLUMN     "status" "public"."MasterStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."Fund" ADD COLUMN     "status" "public"."MasterStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."TaxRate" ALTER COLUMN "glAccountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."AccountingPeriodChecklist" (
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
CREATE TABLE IF NOT EXISTS "public"."CustomerCreditNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "creditNoteDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "public"."CustomerCreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCreditNote_pkey" PRIMARY KEY ("id")
);

-- In newer schema versions, this table may exist without legacy columns.
-- Ensure legacy column exists for indexes/constraints below when replaying into a shadow DB.
ALTER TABLE "public"."CustomerCreditNote" ADD COLUMN IF NOT EXISTS "originalInvoiceId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CustomerCreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "taxRateId" TEXT,
    "vatAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CustomerCreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- In newer schema versions, this table may exist without legacy columns.
-- Ensure legacy column exists for indexes/constraints below when replaying into a shadow DB.
ALTER TABLE "public"."CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "taxRateId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Refund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "creditNoteId" TEXT,
    "receiptId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" "public"."ReceiptPaymentMethod" NOT NULL,
    "reference" TEXT,
    "status" "public"."RefundStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingPeriodChecklist_completedById_idx" ON "public"."AccountingPeriodChecklist"("completedById" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingPeriodChecklist_periodId_idx" ON "public"."AccountingPeriodChecklist"("periodId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingPeriodChecklist_tenantId_idx" ON "public"."AccountingPeriodChecklist"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriodChecklist_tenantId_periodId_checklistCode_key" ON "public"."AccountingPeriodChecklist"("tenantId" ASC, "periodId" ASC, "checklistCode" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_customerId_idx" ON "public"."CustomerCreditNote"("customerId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_originalInvoiceId_idx" ON "public"."CustomerCreditNote"("originalInvoiceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_customerId_creditNoteNumber_key" ON "public"."CustomerCreditNote"("tenantId" ASC, "customerId" ASC, "creditNoteNumber" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_idx" ON "public"."CustomerCreditNote"("tenantId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_status_idx" ON "public"."CustomerCreditNote"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNoteLine_creditNoteId_idx" ON "public"."CustomerCreditNoteLine"("creditNoteId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNoteLine_taxRateId_idx" ON "public"."CustomerCreditNoteLine"("taxRateId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_creditNoteId_idx" ON "public"."Refund"("creditNoteId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_customerId_idx" ON "public"."Refund"("customerId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_receiptId_idx" ON "public"."Refund"("receiptId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_tenantId_idx" ON "public"."Refund"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_tenantId_refundNumber_key" ON "public"."Refund"("tenantId" ASC, "refundNumber" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_tenantId_status_idx" ON "public"."Refund"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInvoice_projectId_idx" ON "public"."CustomerInvoice"("projectId" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fund_tenantId_status_idx" ON "public"."Fund"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_tenantId_status_idx" ON "public"."Project"("tenantId" ASC, "status" ASC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "public"."CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."CustomerCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "public"."TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."CustomerCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

