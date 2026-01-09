DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'INVOICE_DRAFT_CREATED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'INVOICE_DRAFT_CREATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'INVOICE_DRAFT_EDITED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'INVOICE_DRAFT_EDITED';
  END IF;
END $$;
