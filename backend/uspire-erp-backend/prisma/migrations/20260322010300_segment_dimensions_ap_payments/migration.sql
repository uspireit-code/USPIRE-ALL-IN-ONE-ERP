-- Segment dimensions + supplier advance allocations

-- 1) Enum: PaymentAllocationSourceType add SUPPLIER_ADVANCE (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentAllocationSourceType'
      AND e.enumlabel = 'SUPPLIER_ADVANCE'
  ) THEN
    ALTER TYPE "PaymentAllocationSourceType" ADD VALUE 'SUPPLIER_ADVANCE';
  END IF;
END $$;

-- 2) Tenant: add supplierAdvanceAccountId
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "supplierAdvanceAccountId" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Tenant_supplierAdvanceAccountId_fkey'
  ) THEN
    ALTER TABLE "Tenant"
      ADD CONSTRAINT "Tenant_supplierAdvanceAccountId_fkey"
      FOREIGN KEY ("supplierAdvanceAccountId")
      REFERENCES "Account"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Tenant_supplierAdvanceAccountId_idx" ON "Tenant"("supplierAdvanceAccountId");

-- 3) SupplierInvoiceLine: add segment fields
ALTER TABLE "SupplierInvoiceLine"
  ADD COLUMN IF NOT EXISTS "departmentId" text,
  ADD COLUMN IF NOT EXISTS "projectId" text,
  ADD COLUMN IF NOT EXISTS "fundId" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoiceLine_departmentId_fkey'
  ) THEN
    ALTER TABLE "SupplierInvoiceLine"
      ADD CONSTRAINT "SupplierInvoiceLine_departmentId_fkey"
      FOREIGN KEY ("departmentId")
      REFERENCES "Department"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoiceLine_projectId_fkey'
  ) THEN
    ALTER TABLE "SupplierInvoiceLine"
      ADD CONSTRAINT "SupplierInvoiceLine_projectId_fkey"
      FOREIGN KEY ("projectId")
      REFERENCES "Project"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierInvoiceLine_fundId_fkey'
  ) THEN
    ALTER TABLE "SupplierInvoiceLine"
      ADD CONSTRAINT "SupplierInvoiceLine_fundId_fkey"
      FOREIGN KEY ("fundId")
      REFERENCES "Fund"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SupplierInvoiceLine_departmentId_idx" ON "SupplierInvoiceLine"("departmentId");
CREATE INDEX IF NOT EXISTS "SupplierInvoiceLine_projectId_idx" ON "SupplierInvoiceLine"("projectId");
CREATE INDEX IF NOT EXISTS "SupplierInvoiceLine_fundId_idx" ON "SupplierInvoiceLine"("fundId");

-- 4) PaymentAllocation: add segment fields
ALTER TABLE "PaymentAllocation"
  ADD COLUMN IF NOT EXISTS "departmentId" text,
  ADD COLUMN IF NOT EXISTS "projectId" text,
  ADD COLUMN IF NOT EXISTS "fundId" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_departmentId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_departmentId_fkey"
      FOREIGN KEY ("departmentId")
      REFERENCES "Department"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_projectId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_projectId_fkey"
      FOREIGN KEY ("projectId")
      REFERENCES "Project"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_fundId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_fundId_fkey"
      FOREIGN KEY ("fundId")
      REFERENCES "Fund"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PaymentAllocation_departmentId_idx" ON "PaymentAllocation"("departmentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_projectId_idx" ON "PaymentAllocation"("projectId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_fundId_idx" ON "PaymentAllocation"("fundId");
