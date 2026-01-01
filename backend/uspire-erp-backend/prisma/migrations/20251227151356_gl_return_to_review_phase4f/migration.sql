-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_RETURNED_BY_POSTER';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "returnReason" TEXT,
ADD COLUMN     "returnedByPosterAt" TIMESTAMP(3),
ADD COLUMN     "returnedByPosterId" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_returnedByPosterId_fkey" FOREIGN KEY ("returnedByPosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
