-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_AUTO_REVOKED_STALE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
