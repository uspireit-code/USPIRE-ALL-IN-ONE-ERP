-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "correctsJournalId" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_correctsJournalId_fkey" FOREIGN KEY ("correctsJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
