-- Fix missing CustomerCreditNote columns in some dev databases

ALTER TABLE "CustomerCreditNote"
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postedById" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedById" TEXT,
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT,
  ADD COLUMN IF NOT EXISTS "postedJournalId" TEXT;
