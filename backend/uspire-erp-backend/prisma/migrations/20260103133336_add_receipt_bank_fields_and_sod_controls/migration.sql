-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "allowSelfPosting" SET DEFAULT false;
