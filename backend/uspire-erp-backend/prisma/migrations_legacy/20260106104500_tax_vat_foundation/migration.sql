-- CreateTable
CREATE TABLE "TenantTaxConfig" (
    "tenantId" TEXT NOT NULL,
    "outputVatAccountId" TEXT,
    "inputVatAccountId" TEXT,

    CONSTRAINT "TenantTaxConfig_pkey" PRIMARY KEY ("tenantId")
);

-- AlterTable
ALTER TABLE "TaxRate" ADD COLUMN     "code" TEXT;

-- Backfill code from name (best-effort, uppercase, spaces -> underscore), collision-safe per tenant
WITH ranked AS (
  SELECT
    "id",
    "tenantId",
    UPPER(REGEXP_REPLACE(COALESCE("name", ''), '\\s+', '_', 'g')) AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", UPPER(REGEXP_REPLACE(COALESCE("name", ''), '\\s+', '_', 'g'))
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "TaxRate"
)
UPDATE "TaxRate" tr
SET "code" = CASE
  WHEN r.rn = 1 THEN r.base_code
  ELSE (r.base_code || '_' || r.rn::text)
END
FROM ranked r
WHERE tr."id" = r."id"
  AND (tr."code" IS NULL OR tr."code" = '');

-- Convert rate from fraction (0-1) to percent (0-100)
UPDATE "TaxRate"
SET "rate" = "rate" * 100
WHERE "rate" IS NOT NULL AND "rate" <= 1;

-- Ensure code is NOT NULL after backfill
ALTER TABLE "TaxRate" ALTER COLUMN "code" SET NOT NULL;

-- Narrow rate precision to 5,2 (percent)
ALTER TABLE "TaxRate" ALTER COLUMN "rate" TYPE DECIMAL(5,2) USING ROUND("rate"::numeric, 2);

-- Uniqueness per tenant
CREATE UNIQUE INDEX "TaxRate_tenantId_code_key" ON "TaxRate"("tenantId", "code");

-- TenantTaxConfig relations
CREATE INDEX "TenantTaxConfig_outputVatAccountId_idx" ON "TenantTaxConfig"("outputVatAccountId");
CREATE INDEX "TenantTaxConfig_inputVatAccountId_idx" ON "TenantTaxConfig"("inputVatAccountId");

ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_outputVatAccountId_fkey" FOREIGN KEY ("outputVatAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantTaxConfig" ADD CONSTRAINT "TenantTaxConfig_inputVatAccountId_fkey" FOREIGN KEY ("inputVatAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AR invoice VAT flags/line tax selection
ALTER TABLE "CustomerInvoice" ADD COLUMN     "isTaxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomerInvoiceLine" ADD COLUMN     "taxRateId" TEXT;

CREATE INDEX "CustomerInvoiceLine_taxRateId_idx" ON "CustomerInvoiceLine"("taxRateId");
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
