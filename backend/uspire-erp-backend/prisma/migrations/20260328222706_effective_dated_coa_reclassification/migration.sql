-- CreateEnum
CREATE TYPE "CoaStructuralChangeType" AS ENUM ('HIERARCHY_RECLASSIFICATION', 'IFRS_RECLASSIFICATION');

-- AlterEnum
ALTER TYPE "CoaStructureChangeRequestType" ADD VALUE 'EFFECTIVE_DATED_RECLASSIFICATION';

-- CreateTable
CREATE TABLE "CoaStructuralChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "changeType" "CoaStructuralChangeType" NOT NULL,
    "oldParentAccountId" TEXT,
    "newParentAccountId" TEXT,
    "oldIfrsNodeId" TEXT,
    "newIfrsNodeId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "sourceChangeRequestId" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "implementedByUserId" TEXT NOT NULL,
    "implementedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaStructuralChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoaStructuralChange_tenantId_idx" ON "CoaStructuralChange"("tenantId");

-- CreateIndex
CREATE INDEX "CoaStructuralChange_tenantId_accountId_idx" ON "CoaStructuralChange"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "CoaStructuralChange_effectiveFrom_idx" ON "CoaStructuralChange"("effectiveFrom");

-- CreateIndex
CREATE INDEX "CoaStructuralChange_isActive_idx" ON "CoaStructuralChange"("isActive");

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_oldParentAccountId_fkey" FOREIGN KEY ("oldParentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_newParentAccountId_fkey" FOREIGN KEY ("newParentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_oldIfrsNodeId_fkey" FOREIGN KEY ("oldIfrsNodeId") REFERENCES "IfrsNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_newIfrsNodeId_fkey" FOREIGN KEY ("newIfrsNodeId") REFERENCES "IfrsNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_sourceChangeRequestId_fkey" FOREIGN KEY ("sourceChangeRequestId") REFERENCES "CoaStructureChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructuralChange" ADD CONSTRAINT "CoaStructuralChange_implementedByUserId_fkey" FOREIGN KEY ("implementedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
