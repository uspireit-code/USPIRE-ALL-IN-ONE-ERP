-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'CHART_OF_ACCOUNTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_IMPORTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_CLEANUP_EXECUTED';

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
