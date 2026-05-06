-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_ROOT_CATEGORY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_ROOT_CATEGORY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_ROOT_CATEGORY_DISABLED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_ROOT_CATEGORY_SETUP_DEFAULT';

-- AlterEnum
ALTER TYPE "BudgetControlMode" ADD VALUE 'NONE';

-- CreateTable
CREATE TABLE "CoaRootCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "fsMappingLevel1" TEXT,
    "fsMappingLevel2" TEXT,
    "ifrsMappingCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CoaRootCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoaRootCategory_tenantId_idx" ON "CoaRootCategory"("tenantId");

-- CreateIndex
CREATE INDEX "CoaRootCategory_createdById_idx" ON "CoaRootCategory"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "CoaRootCategory_tenantId_code_key" ON "CoaRootCategory"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CoaRootCategory_tenantId_name_key" ON "CoaRootCategory"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "CoaRootCategory" ADD CONSTRAINT "CoaRootCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaRootCategory" ADD CONSTRAINT "CoaRootCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
