-- Fix recurring journal template schema drift: ensure JournalIntent type exists and intent fields exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JournalIntent') THEN
    CREATE TYPE "JournalIntent" AS ENUM ('OPERATIONAL', 'ACCRUAL', 'ADJUSTMENT');
  END IF;
END $$;

ALTER TABLE "RecurringJournalTemplate"
ADD COLUMN IF NOT EXISTS "intent" "JournalIntent" NOT NULL DEFAULT 'OPERATIONAL',
ADD COLUMN IF NOT EXISTS "intentNotes" TEXT,
ADD COLUMN IF NOT EXISTS "intentReference" TEXT;
