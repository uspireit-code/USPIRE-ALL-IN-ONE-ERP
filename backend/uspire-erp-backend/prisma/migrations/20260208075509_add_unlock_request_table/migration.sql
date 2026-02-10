-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'ACCOUNT_UNLOCK_REQUESTED';

-- CreateTable
CREATE TABLE "UnlockRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UnlockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnlockRequest_tenantId_idx" ON "UnlockRequest"("tenantId");

-- CreateIndex
CREATE INDEX "UnlockRequest_userEmail_idx" ON "UnlockRequest"("userEmail");

-- AddForeignKey
ALTER TABLE "UnlockRequest" ADD CONSTRAINT "UnlockRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
