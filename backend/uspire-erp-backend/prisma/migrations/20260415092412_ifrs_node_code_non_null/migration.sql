-- This is an empty migration.

UPDATE "IfrsNode"
SET "code" = NULL
WHERE "code" IS NOT NULL AND btrim("code") = '';

UPDATE "IfrsNode"
SET "code" = CASE
  WHEN "statement" = 'BS' AND lower(btrim("name")) IN ('asset', 'assets') THEN 'BS_ASSETS'
  WHEN "statement" = 'BS' AND lower(btrim("name")) IN ('liability', 'liabilities') THEN 'BS_LIABILITY'
  WHEN "statement" = 'BS' AND lower(btrim("name")) IN ('equity', 'shareholders equity', 'shareholder equity') THEN 'BS_EQUITY'
  WHEN "statement" = 'PL' AND lower(btrim("name")) IN ('revenue', 'revenues', 'income') THEN 'PL_REVENUE'
  WHEN "statement" = 'PL' AND lower(btrim("name")) IN ('cost of sales', 'cost of sale', 'cogs') THEN 'PL_COST_OF_SALES'
  WHEN "statement" = 'PL' AND lower(btrim("name")) IN ('operating expenses', 'operating expense', 'opex') THEN 'PL_OPERATING_EXPENSES'
  ELSE NULL
END
WHERE "code" IS NULL;

UPDATE "IfrsNode"
SET "code" = concat(
  "statement"::text,
  '_',
  regexp_replace(upper(btrim("name")), '[^A-Z0-9]+', '_', 'g')
)
WHERE "code" IS NULL;

ALTER TABLE "IfrsNode" ALTER COLUMN "code" SET NOT NULL;