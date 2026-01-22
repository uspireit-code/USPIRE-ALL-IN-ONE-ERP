-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'BANK_RECON_ADJUSTMENT_JOURNAL_CREATED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'BANK_RECON_ADJUSTMENT_JOURNAL_CREATED';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "BankStatementLine" ADD COLUMN     "adjustmentJournalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_adjustmentJournalId_key" ON "BankStatementLine"("adjustmentJournalId");

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_adjustmentJournalId_fkey" FOREIGN KEY ("adjustmentJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
