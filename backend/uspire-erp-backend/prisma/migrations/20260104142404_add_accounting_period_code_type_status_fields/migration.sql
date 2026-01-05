-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'PERIOD_CLOSED';

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
