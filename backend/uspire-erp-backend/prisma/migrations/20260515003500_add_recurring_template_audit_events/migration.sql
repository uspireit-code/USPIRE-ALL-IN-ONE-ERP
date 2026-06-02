-- Add AuditEventType enum values for recurring template lifecycle transitions

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'RECURRING_TEMPLATE_SUBMITTED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_SUBMITTED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'RECURRING_TEMPLATE_APPROVED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_APPROVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'RECURRING_TEMPLATE_SUSPENDED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_SUSPENDED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'RECURRING_TEMPLATE_ARCHIVED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_ARCHIVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditEventType'
      AND e.enumlabel = 'RECURRING_TEMPLATE_REACTIVATED'
  ) THEN
    ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_REACTIVATED';
  END IF;
END $$;
