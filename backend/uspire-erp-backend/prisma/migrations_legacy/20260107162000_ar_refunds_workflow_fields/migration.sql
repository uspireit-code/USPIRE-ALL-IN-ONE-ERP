-- Step 4.3: Refund workflow/payment/audit fields (additive, idempotent)

-- RefundPaymentMethod enum
DO $$ BEGIN
  CREATE TYPE "RefundPaymentMethod" AS ENUM ('BANK', 'CASH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tenant cash clearing account mapping
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "cashClearingAccountId" TEXT;

-- CustomerRefund fields
ALTER TABLE "CustomerRefund"
  ADD COLUMN IF NOT EXISTS "paymentMethod" "RefundPaymentMethod",
  ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "voidedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT,
  ADD COLUMN IF NOT EXISTS "postedJournalId" TEXT;

-- Backfill paymentMethod for existing rows (assume BANK)
UPDATE "CustomerRefund"
SET "paymentMethod" = 'BANK'
WHERE "paymentMethod" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "CustomerRefund"
  ALTER COLUMN "paymentMethod" SET NOT NULL;

-- Indexes/constraints
CREATE INDEX IF NOT EXISTS "CustomerRefund_tenantId_creditNoteId_idx" ON "CustomerRefund" ("tenantId", "creditNoteId");

DO $$ BEGIN
  ALTER TABLE "CustomerRefund"
    ADD CONSTRAINT "CustomerRefund_tenantId_postedJournalId_key" UNIQUE ("tenantId", "postedJournalId");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
