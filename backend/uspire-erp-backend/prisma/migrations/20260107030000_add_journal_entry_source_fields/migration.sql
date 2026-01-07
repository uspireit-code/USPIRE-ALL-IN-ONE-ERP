-- Add source linkage fields for journals (document provenance)

ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'JournalEntry_tenantId_sourceType_sourceId_idx'
  ) THEN
    CREATE INDEX "JournalEntry_tenantId_sourceType_sourceId_idx"
      ON "JournalEntry"("tenantId", "sourceType", "sourceId");
  END IF;
END $$;
