-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "fsMappingLevel1" TEXT,
ADD COLUMN     "fsMappingLevel2" TEXT,
ADD COLUMN     "subCategory" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
