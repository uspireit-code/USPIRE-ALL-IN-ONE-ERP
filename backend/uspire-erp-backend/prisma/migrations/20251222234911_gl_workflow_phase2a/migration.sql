-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_POSTED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_REVERSED';
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_POST_BLOCKED';
ALTER TYPE "AuditEventType" ADD VALUE 'FA_POST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "JournalStatus" ADD VALUE 'REVIEWED';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
