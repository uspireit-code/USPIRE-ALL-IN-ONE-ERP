-- CreateEnum
CREATE TYPE "DelegationScope" AS ENUM ('APPROVE', 'POST', 'BOTH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_ACTIVATED';
ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_EXPIRED';
ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_EXPIRED_ACCESS_BLOCKED';
ALTER TYPE "AuditEventType" ADD VALUE 'DELEGATION_ACTION_BLOCKED_SOD';

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "actingAsUserId" TEXT,
ADD COLUMN     "delegationId" TEXT,
ADD COLUMN     "realUserId" TEXT;

-- CreateTable
CREATE TABLE "UserDelegation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delegatorUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" "DelegationScope" NOT NULL,

    CONSTRAINT "UserDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDelegation_tenantId_idx" ON "UserDelegation"("tenantId");

-- CreateIndex
CREATE INDEX "UserDelegation_tenantId_delegatorUserId_idx" ON "UserDelegation"("tenantId", "delegatorUserId");

-- CreateIndex
CREATE INDEX "UserDelegation_tenantId_delegateUserId_idx" ON "UserDelegation"("tenantId", "delegateUserId");

-- CreateIndex
CREATE INDEX "UserDelegation_tenantId_delegatorUserId_delegateUserId_idx" ON "UserDelegation"("tenantId", "delegatorUserId", "delegateUserId");

-- CreateIndex
CREATE INDEX "UserDelegation_tenantId_expiresAt_idx" ON "UserDelegation"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_delegationId_idx" ON "UserSession"("delegationId");

-- CreateIndex
CREATE INDEX "UserSession_actingAsUserId_idx" ON "UserSession"("actingAsUserId");

-- CreateIndex
CREATE INDEX "UserSession_realUserId_idx" ON "UserSession"("realUserId");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "UserDelegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_actingAsUserId_fkey" FOREIGN KEY ("actingAsUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_realUserId_fkey" FOREIGN KEY ("realUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_delegatorUserId_fkey" FOREIGN KEY ("delegatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_delegateUserId_fkey" FOREIGN KEY ("delegateUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegation" ADD CONSTRAINT "UserDelegation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
