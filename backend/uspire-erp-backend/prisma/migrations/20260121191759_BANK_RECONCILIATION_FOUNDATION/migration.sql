-- CreateEnum
CREATE TYPE "BankStatementStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'RECONCILED', 'LOCKED');

-- CreateEnum
CREATE TYPE "BankStatementLineClassification" AS ENUM ('SYSTEM_MATCH', 'BANK_CHARGE', 'INTEREST', 'ERROR', 'UNIDENTIFIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'BANK_STATEMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'BANK_STATEMENT_LINE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'CREATE_BANK_STATEMENT';
ALTER TYPE "AuditEventType" ADD VALUE 'ADD_BANK_STATEMENT_LINE';

-- DropForeignKey
ALTER TABLE "BankReconciliation" DROP CONSTRAINT "BankReconciliation_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "BankReconciliation" DROP CONSTRAINT "BankReconciliation_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "BankReconciliation" DROP CONSTRAINT "BankReconciliation_statementLineId_fkey";

-- DropForeignKey
ALTER TABLE "BankReconciliation" DROP CONSTRAINT "BankReconciliation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "BankStatementLine" DROP CONSTRAINT "BankStatementLine_bankStatementId_fkey";

-- DropIndex
DROP INDEX "BankStatement_tenantId_bankAccountId_statementDate_key";

-- DropIndex
DROP INDEX "BankStatementLine_bankStatementId_idx";

-- DropIndex
DROP INDEX "BankStatementLine_isReconciled_idx";

-- DropIndex
DROP INDEX "BankStatementLine_transactionDate_idx";

-- AlterTable
ALTER TABLE "BankStatement" DROP COLUMN "statementDate",
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "statementEndDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "statementStartDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "BankStatementStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BankStatementLine" DROP COLUMN "amount",
DROP COLUMN "bankStatementId",
DROP COLUMN "isReconciled",
DROP COLUMN "reconciledAt",
DROP COLUMN "reconciledBy",
DROP COLUMN "transactionDate",
ADD COLUMN     "classification" "BankStatementLineClassification" NOT NULL DEFAULT 'UNIDENTIFIED',
ADD COLUMN     "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "matched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchedJournalLineId" TEXT,
ADD COLUMN     "statementId" TEXT NOT NULL,
ADD COLUMN     "txnDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "bankStatementLineId" TEXT,
ADD COLUMN     "cleared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clearedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "BankReconciliation";

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_bankAccountId_statementStartDate_idx" ON "BankStatement"("tenantId", "bankAccountId", "statementStartDate");

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_bankAccountId_statementEndDate_idx" ON "BankStatement"("tenantId", "bankAccountId", "statementEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_tenantId_bankAccountId_statementEndDate_key" ON "BankStatement"("tenantId", "bankAccountId", "statementEndDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");

-- CreateIndex
CREATE INDEX "BankStatementLine_txnDate_idx" ON "BankStatementLine"("txnDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_matched_idx" ON "BankStatementLine"("matched");

-- CreateIndex
CREATE INDEX "BankStatementLine_matchedJournalLineId_idx" ON "BankStatementLine"("matchedJournalLineId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_matchedJournalLineId_key" ON "BankStatementLine"("matchedJournalLineId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_bankStatementLineId_key" ON "JournalLine"("bankStatementLineId");

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedJournalLineId_fkey" FOREIGN KEY ("matchedJournalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_bankStatementLineId_fkey" FOREIGN KEY ("bankStatementLineId") REFERENCES "BankStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
