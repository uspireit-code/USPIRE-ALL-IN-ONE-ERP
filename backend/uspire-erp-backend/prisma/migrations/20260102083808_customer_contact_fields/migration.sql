-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactPerson" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
