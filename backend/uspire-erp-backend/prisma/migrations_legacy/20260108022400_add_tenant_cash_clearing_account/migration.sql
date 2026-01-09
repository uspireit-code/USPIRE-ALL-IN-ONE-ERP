ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "cashClearingAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Tenant_cashClearingAccountId_fkey'
  ) THEN
    ALTER TABLE "Tenant"
    ADD CONSTRAINT "Tenant_cashClearingAccountId_fkey"
    FOREIGN KEY ("cashClearingAccountId")
    REFERENCES "Account"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;
