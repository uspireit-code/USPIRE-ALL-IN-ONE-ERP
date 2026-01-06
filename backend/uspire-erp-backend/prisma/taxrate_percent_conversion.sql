-- Backfill TaxRate.code from name (collision-safe per tenant)
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

-- Convert TaxRate.rate from fraction (0-1) to percent (0-100)
UPDATE "TaxRate"
SET "rate" = ROUND(("rate" * 100)::numeric, 2)
WHERE "rate" IS NOT NULL AND "rate" <= 1;

-- Normalize precision to 2 decimals (percent)
UPDATE "TaxRate"
SET "rate" = ROUND("rate"::numeric, 2)
WHERE "rate" IS NOT NULL;
