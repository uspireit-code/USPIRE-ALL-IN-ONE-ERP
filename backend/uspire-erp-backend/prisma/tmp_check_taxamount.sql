SELECT current_database() AS db, current_schema() AS schema;

SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'CustomerCreditNote'
    AND column_name = 'taxAmount'
) AS has_tax_amount;
