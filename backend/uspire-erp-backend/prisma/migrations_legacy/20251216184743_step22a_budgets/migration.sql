-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'BUDGET';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'BUDGET_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'BUDGET_APPROVE';

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

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "BudgetLine_revisionId_accountId_periodId_key" ON "BudgetLine"("revisionId", "accountId", "periodId");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "BudgetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
