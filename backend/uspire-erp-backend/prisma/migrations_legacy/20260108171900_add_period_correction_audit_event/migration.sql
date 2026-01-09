DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'PERIOD_CORRECTION'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'PERIOD_CORRECTION';
  END IF;
END $$;
