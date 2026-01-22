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
      AND e.enumlabel = 'BANK_RECON_LINE_MATCHED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'BANK_RECON_LINE_MATCHED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'BANK_RECON_LINE_UNMATCHED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'BANK_RECON_LINE_UNMATCHED';
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JournalLine_accountId_cleared_idx" ON "JournalLine"("accountId", "cleared");
