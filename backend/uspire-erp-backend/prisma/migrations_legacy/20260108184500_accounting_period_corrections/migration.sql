DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'PERIOD_CORRECTED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'PERIOD_CORRECTED';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AccountingPeriodCorrection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "oldStartDate" TIMESTAMP(3) NOT NULL,
  "oldEndDate" TIMESTAMP(3) NOT NULL,
  "newStartDate" TIMESTAMP(3) NOT NULL,
  "newEndDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "correctedBy" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingPeriodCorrection_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriodCorrection_tenantId_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriodCorrection"
    ADD CONSTRAINT "AccountingPeriodCorrection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriodCorrection_periodId_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriodCorrection"
    ADD CONSTRAINT "AccountingPeriodCorrection_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriodCorrection_correctedBy_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriodCorrection"
    ADD CONSTRAINT "AccountingPeriodCorrection_correctedBy_fkey"
    FOREIGN KEY ("correctedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AccountingPeriodCorrection_tenantId_idx" ON "AccountingPeriodCorrection"("tenantId");
CREATE INDEX IF NOT EXISTS "AccountingPeriodCorrection_tenantId_periodId_idx" ON "AccountingPeriodCorrection"("tenantId", "periodId");
CREATE INDEX IF NOT EXISTS "AccountingPeriodCorrection_correctedBy_idx" ON "AccountingPeriodCorrection"("correctedBy");
