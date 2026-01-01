-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVERSAL_ASSIGNED';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "reversalPreparedById" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalPreparedById_fkey" FOREIGN KEY ("reversalPreparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
