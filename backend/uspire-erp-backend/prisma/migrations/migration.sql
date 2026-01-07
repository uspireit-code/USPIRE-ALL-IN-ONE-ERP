-- CreateEnum
CREATE TYPE "public"."CustomerCreditNoteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."InvoiceType" AS ENUM ('TRAINING', 'CONSULTING', 'SYSTEMS', 'PUBLISHING', 'DONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."RefundStatus" AS ENUM ('DRAFT', 'POSTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditEntityType" ADD VALUE 'INVOICE_CATEGORY';
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'TAX_RATE';
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'TENANT_TAX_CONFIG';
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'DEPARTMENT';
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'PROJECT';
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'FUND';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditEventType" ADD VALUE 'DEPARTMENT_CREATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'DEPARTMENT_UPDATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_CREATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_UPDATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'PROJECT_CLOSED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'FUND_CREATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'FUND_UPDATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_CREATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_UPDATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'INVOICE_CATEGORY_STATUS_CHANGE';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_CREATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_UPDATED';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_RATE_STATUS_CHANGE';
ALTER TYPE "public"."AuditEventType" ADD VALUE 'TAX_CONFIG_UPDATED';

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
CREATE TABLE "public"."AccountingPeriodChecklist" (
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
CREATE TABLE "public"."CustomerCreditNote" (
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

-- CreateTable
CREATE TABLE "public"."CustomerCreditNoteLine" (
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

-- CreateTable
CREATE TABLE "public"."Refund" (
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
CREATE INDEX "AccountingPeriodChecklist_completedById_idx" ON "public"."AccountingPeriodChecklist"("completedById" ASC);

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklist_periodId_idx" ON "public"."AccountingPeriodChecklist"("periodId" ASC);

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklist_tenantId_idx" ON "public"."AccountingPeriodChecklist"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriodChecklist_tenantId_periodId_checklistCode_key" ON "public"."AccountingPeriodChecklist"("tenantId" ASC, "periodId" ASC, "checklistCode" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNote_customerId_idx" ON "public"."CustomerCreditNote"("customerId" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNote_originalInvoiceId_idx" ON "public"."CustomerCreditNote"("originalInvoiceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditNote_tenantId_customerId_creditNoteNumber_key" ON "public"."CustomerCreditNote"("tenantId" ASC, "customerId" ASC, "creditNoteNumber" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_idx" ON "public"."CustomerCreditNote"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_status_idx" ON "public"."CustomerCreditNote"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNoteLine_creditNoteId_idx" ON "public"."CustomerCreditNoteLine"("creditNoteId" ASC);

-- CreateIndex
CREATE INDEX "CustomerCreditNoteLine_taxRateId_idx" ON "public"."CustomerCreditNoteLine"("taxRateId" ASC);

-- CreateIndex
CREATE INDEX "Refund_creditNoteId_idx" ON "public"."Refund"("creditNoteId" ASC);

-- CreateIndex
CREATE INDEX "Refund_customerId_idx" ON "public"."Refund"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Refund_receiptId_idx" ON "public"."Refund"("receiptId" ASC);

-- CreateIndex
CREATE INDEX "Refund_tenantId_idx" ON "public"."Refund"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_tenantId_refundNumber_key" ON "public"."Refund"("tenantId" ASC, "refundNumber" ASC);

-- CreateIndex
CREATE INDEX "Refund_tenantId_status_idx" ON "public"."Refund"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "CustomerInvoice_projectId_idx" ON "public"."CustomerInvoice"("projectId" ASC);

-- CreateIndex
CREATE INDEX "Fund_tenantId_status_idx" ON "public"."Fund"("tenantId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "public"."Project"("tenantId" ASC, "status" ASC);

-- AddForeignKey
ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountingPeriodChecklist" ADD CONSTRAINT "AccountingPeriodChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "public"."CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."CustomerCreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "public"."TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "public"."CustomerCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

