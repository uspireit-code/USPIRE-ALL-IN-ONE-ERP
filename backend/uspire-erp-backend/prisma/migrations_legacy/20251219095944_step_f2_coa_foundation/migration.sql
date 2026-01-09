-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'ACCOUNT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_DEACTIVATE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_FREEZE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_UNFREEZE';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "ifrsMappingCode" TEXT,
ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPosting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentAccountId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "coaFrozen" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Account_tenantId_parentAccountId_idx" ON "Account"("tenantId", "parentAccountId");

-- CreateIndex
CREATE INDEX "Account_createdById_idx" ON "Account"("createdById");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
