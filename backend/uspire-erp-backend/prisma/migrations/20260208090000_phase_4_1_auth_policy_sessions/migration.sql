-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_RESET_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_EXPIRED_LOGIN_BLOCKED';
ALTER TYPE "AuditEventType" ADD VALUE 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED';
ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_EXPIRED';
ALTER TYPE "AuditEventType" ADD VALUE 'CONCURRENT_SESSION_BLOCKED';
ALTER TYPE "AuditEventType" ADD VALUE 'LOGOUT';
ALTER TYPE "AuditEventType" ADD VALUE 'OTP_SUCCESS';
ALTER TYPE "AuditEventType" ADD VALUE 'OTP_FAILED';

-- DropIndex
DROP INDEX "CustomerInvoiceImportLog_tenantId_processedAt_idx";

-- AlterTable
ALTER TABLE "CustomerInvoiceImportLog" DROP COLUMN "processedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "processedById" SET NOT NULL;

-- AlterTable
ALTER TABLE "CustomerReceipt" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeSessionId" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "passwordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSession_tenantId_idx" ON "UserSession"("tenantId");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_tenantId_glJournalId_key" ON "CustomerReceipt"("tenantId", "glJournalId");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

