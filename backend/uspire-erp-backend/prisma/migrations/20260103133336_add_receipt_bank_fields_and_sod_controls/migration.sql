-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allowSelfPosting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ALTER COLUMN "allowSelfPosting" SET DEFAULT false;
