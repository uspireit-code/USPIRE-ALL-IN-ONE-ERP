/*
  Warnings:

  - A unique constraint covering the columns `[revisionId,accountId,periodId,legalEntityId,departmentId,projectId,fundId]` on the table `BudgetLine` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BudgetControlMode" AS ENUM ('WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "JournalBudgetStatus" AS ENUM ('OK', 'WARN', 'BLOCK');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_BUDGET_EVALUATED';

-- DropIndex
DROP INDEX "BudgetLine_revisionId_accountId_periodId_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "budgetControlMode" "BudgetControlMode" NOT NULL DEFAULT 'WARN',
ADD COLUMN     "isBudgetRelevant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BudgetLine" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "legalEntityId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "budgetCheckedAt" TIMESTAMP(3),
ADD COLUMN     "budgetFlags" JSONB,
ADD COLUMN     "budgetOverrideJustification" TEXT,
ADD COLUMN     "budgetStatus" "JournalBudgetStatus" NOT NULL DEFAULT 'OK',
ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

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
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
