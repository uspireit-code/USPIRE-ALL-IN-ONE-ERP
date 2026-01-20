-- Phase 3A: Imprest settlement journal link + Option A expense GL account on settlement lines

-- ImprestCase: settlement journal link + audit fields
ALTER TABLE "ImprestCase"
  ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "settlementJournalId" TEXT;

-- ImprestSettlementLine: expense GL account
ALTER TABLE "ImprestSettlementLine"
  ADD COLUMN IF NOT EXISTS "glAccountId" TEXT;

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ImprestCase_settledByUserId_fkey'
  ) THEN
    ALTER TABLE "ImprestCase"
      ADD CONSTRAINT "ImprestCase_settledByUserId_fkey"
      FOREIGN KEY ("settledByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ImprestCase_settlementJournalId_fkey'
  ) THEN
    ALTER TABLE "ImprestCase"
      ADD CONSTRAINT "ImprestCase_settlementJournalId_fkey"
      FOREIGN KEY ("settlementJournalId") REFERENCES "JournalEntry"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ImprestSettlementLine_glAccountId_fkey'
  ) THEN
    ALTER TABLE "ImprestSettlementLine"
      ADD CONSTRAINT "ImprestSettlementLine_glAccountId_fkey"
      FOREIGN KEY ("glAccountId") REFERENCES "Account"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes / constraints
CREATE UNIQUE INDEX IF NOT EXISTS "ImprestCase_tenantId_settlementJournalId_key"
  ON "ImprestCase"("tenantId", "settlementJournalId");

CREATE INDEX IF NOT EXISTS "ImprestSettlementLine_glAccountId_idx"
  ON "ImprestSettlementLine"("glAccountId");
