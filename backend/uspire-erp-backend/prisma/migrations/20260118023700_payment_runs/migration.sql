-- CreateEnum
CREATE TYPE "PaymentRunStatus" AS ENUM ('EXECUTED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_RUN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_RUN_EXECUTED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'PAYMENT_RUN';

-- CreateTable
CREATE TABLE "PaymentRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "executionDate" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "PaymentRunStatus" NOT NULL DEFAULT 'EXECUTED',
    "executedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRunLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentRunId" TEXT NOT NULL,
    "paymentProposalLineId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PaymentRunLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRun_tenantId_runNumber_key" ON "PaymentRun"("tenantId", "runNumber");

-- CreateIndex
CREATE INDEX "PaymentRun_tenantId_idx" ON "PaymentRun"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentRun_tenantId_executionDate_idx" ON "PaymentRun"("tenantId", "executionDate");

-- CreateIndex
CREATE INDEX "PaymentRun_periodId_idx" ON "PaymentRun"("periodId");

-- CreateIndex
CREATE INDEX "PaymentRun_bankAccountId_idx" ON "PaymentRun"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRunLine_paymentProposalLineId_key" ON "PaymentRunLine"("paymentProposalLineId");

-- CreateIndex
CREATE INDEX "PaymentRunLine_tenantId_idx" ON "PaymentRunLine"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentRunLine_paymentRunId_idx" ON "PaymentRunLine"("paymentRunId");

-- CreateIndex
CREATE INDEX "PaymentRunLine_supplierId_idx" ON "PaymentRunLine"("supplierId");

-- CreateIndex
CREATE INDEX "PaymentRunLine_invoiceId_idx" ON "PaymentRunLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunLine" ADD CONSTRAINT "PaymentRunLine_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunLine" ADD CONSTRAINT "PaymentRunLine_paymentProposalLineId_fkey" FOREIGN KEY ("paymentProposalLineId") REFERENCES "PaymentProposalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunLine" ADD CONSTRAINT "PaymentRunLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunLine" ADD CONSTRAINT "PaymentRunLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunLine" ADD CONSTRAINT "PaymentRunLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
