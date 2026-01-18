-- 1) Safety: ensure tenantId+invoiceNumber is unique by suffixing duplicates (idempotent)
WITH ranked AS (
  SELECT
    id,
    "tenantId" AS tenant_id,
    "invoiceNumber" AS inv_no,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "invoiceNumber"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "SupplierInvoice"
)
UPDATE "SupplierInvoice" s
SET "invoiceNumber" = CONCAT(ranked.inv_no, '-', ranked.rn)
FROM ranked
WHERE s.id = ranked.id
  AND ranked.rn > 1
  AND s."invoiceNumber" = ranked.inv_no;

-- 2) Drop old constraint (if present) and replace with tenant-wide invoiceNumber uniqueness
ALTER TABLE "SupplierInvoice"
  DROP CONSTRAINT IF EXISTS "SupplierInvoice_tenantId_supplierId_invoiceNumber_key";

ALTER TABLE "SupplierInvoice"
  DROP CONSTRAINT IF EXISTS "SupplierInvoice_tenantId_invoiceNumber_key";

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_tenantId_invoiceNumber_key" UNIQUE ("tenantId", "invoiceNumber");
