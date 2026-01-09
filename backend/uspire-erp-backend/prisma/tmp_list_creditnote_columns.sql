SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'CustomerCreditNote'
ORDER BY ordinal_position;
