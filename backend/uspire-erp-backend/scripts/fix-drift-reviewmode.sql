-- Add missing AuditEventType enum variants (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_OVERRIDE_POSTED';
  EXCEPTION WHEN undefined_object THEN
    -- If enum type doesn't exist, let Prisma migrations handle it.
    NULL;
  END;

  BEGIN
    ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_SOD_VIOLATION_BLOCKED';
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_SYSTEM_REVIEWED';
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'GL_LIFECYCLE_BYPASS_BLOCKED';
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Create missing JournalReviewMode enum (idempotent)
DO $$
BEGIN
  CREATE TYPE "JournalReviewMode" AS ENUM ('MANUAL_REVIEW', 'SYSTEM_REVIEW', 'OVERRIDE_REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add missing column on JournalEntry (idempotent)
ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "reviewMode" "JournalReviewMode";
