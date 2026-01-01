-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVERSAL_INITIATED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVERSAL_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVERSAL_POSTED';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "reversalInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "reversalInitiatedById" TEXT,
ADD COLUMN     "reversalReason" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalInitiatedById_fkey" FOREIGN KEY ("reversalInitiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
