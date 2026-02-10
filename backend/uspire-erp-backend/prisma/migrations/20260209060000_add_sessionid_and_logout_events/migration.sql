-- AlterEnum
DO $$
BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_LOGIN_BLOCKED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_LOGOUT';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- Backfill: for existing rows created before sessionId existed
UPDATE "UserSession" SET "sessionId" = "id" WHERE "sessionId" IS NULL;

-- Ensure not null
ALTER TABLE "UserSession" ALTER COLUMN "sessionId" SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "UserSession_sessionId_idx" ON "UserSession"("sessionId");
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- Foreign keys: align with schema (onDelete: Cascade)
ALTER TABLE "UserSession" DROP CONSTRAINT IF EXISTS "UserSession_tenantId_fkey";
ALTER TABLE "UserSession" DROP CONSTRAINT IF EXISTS "UserSession_userId_fkey";

ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
