-- Add missing memo column for CustomerCreditNote

ALTER TABLE "CustomerCreditNote"
  ADD COLUMN IF NOT EXISTS "memo" TEXT;
