-- Add recurring template lifecycle enum + governance fields (backward-compatible with isActive)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringTemplateStatus') THEN
    CREATE TYPE "RecurringTemplateStatus" AS ENUM (
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SUSPENDED',
      'ARCHIVED'
    );
  END IF;
END $$;

ALTER TABLE "RecurringJournalTemplate"
ADD COLUMN IF NOT EXISTS "status" "RecurringTemplateStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "submittedById" TEXT,
ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "suspendedById" TEXT,
ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "archivedById" TEXT,
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "statusReason" TEXT;

-- Backfill status from existing isActive for legacy templates.
-- If status is already set to a non-default value, preserve it.
UPDATE "RecurringJournalTemplate"
SET "status" = CASE
  WHEN "isActive" = TRUE THEN 'APPROVED'::"RecurringTemplateStatus"
  ELSE 'SUSPENDED'::"RecurringTemplateStatus"
END
WHERE "status" IS NULL OR "status" = 'DRAFT'::"RecurringTemplateStatus";

-- Ensure isActive is synchronized from status post-migration.
UPDATE "RecurringJournalTemplate"
SET "isActive" = ("status" = 'APPROVED'::"RecurringTemplateStatus")
WHERE "isActive" IS DISTINCT FROM ("status" = 'APPROVED'::"RecurringTemplateStatus");

CREATE INDEX IF NOT EXISTS "RecurringJournalTemplate_tenantId_status_idx"
ON "RecurringJournalTemplate" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "RecurringJournalTemplate_submittedById_idx"
ON "RecurringJournalTemplate" ("submittedById");

CREATE INDEX IF NOT EXISTS "RecurringJournalTemplate_approvedById_idx"
ON "RecurringJournalTemplate" ("approvedById");

CREATE INDEX IF NOT EXISTS "RecurringJournalTemplate_suspendedById_idx"
ON "RecurringJournalTemplate" ("suspendedById");

CREATE INDEX IF NOT EXISTS "RecurringJournalTemplate_archivedById_idx"
ON "RecurringJournalTemplate" ("archivedById");
