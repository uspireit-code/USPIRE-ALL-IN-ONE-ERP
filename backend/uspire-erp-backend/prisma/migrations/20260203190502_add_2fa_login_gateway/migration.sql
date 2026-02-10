-- CreateEnum
CREATE TYPE "TwoFactorMethod" AS ENUM ('EMAIL', 'TOTP', 'SMS');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'TWO_FACTOR_CHALLENGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_LOGIN_SUCCESS';
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_LOGIN_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_2FA_CHALLENGE_SENT';
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_2FA_VERIFY_SUCCESS';
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_2FA_VERIFY_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_2FA_LOCKED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoFactorLockUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorMethod" "TwoFactorMethod",
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "TwoFactorMethod" NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_tenantId_idx" ON "TwoFactorChallenge"("tenantId");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_tenantId_userId_idx" ON "TwoFactorChallenge"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_expiresAt_idx" ON "TwoFactorChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
