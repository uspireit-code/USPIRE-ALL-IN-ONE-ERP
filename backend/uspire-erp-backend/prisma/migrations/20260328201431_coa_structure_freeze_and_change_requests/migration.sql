/*
  Warnings:

  - The `status` column on the `Tenant` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CoaStructureChangeRequestType" AS ENUM ('SEGMENT_DEFINITION', 'SEGMENT_ORDER', 'HIERARCHY_CHANGE', 'ADD_ACCOUNT', 'REPORTING_NODE_CHANGE', 'TEMPLATE_EXTENSION', 'ROOT_CATEGORY_MODIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CoaStructureChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_FREEZE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_UNFREEZE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_REQUEST_IMPLEMENTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STRUCTURE_CHANGE_BLOCKED';

-- DropIndex
DROP INDEX "Tenant_supplierAdvanceAccountId_idx";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "coaStructureFreezeEffectiveDate" TIMESTAMP(3),
ADD COLUMN     "coaStructureFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coaStructureFrozenAt" TIMESTAMP(3),
ADD COLUMN     "coaStructureFrozenByUserId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "CoaStructureChangeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestType" "CoaStructureChangeRequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "proposedState" JSONB NOT NULL,
    "status" "CoaStructureChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "implementedById" TEXT,
    "implementedAt" TIMESTAMP(3),

    CONSTRAINT "CoaStructureChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaStructureChangeRequestAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoaStructureChangeRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_tenantId_idx" ON "CoaStructureChangeRequest"("tenantId");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_tenantId_status_idx" ON "CoaStructureChangeRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_tenantId_requestedAt_idx" ON "CoaStructureChangeRequest"("tenantId", "requestedAt");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_requestedById_idx" ON "CoaStructureChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_approvedById_idx" ON "CoaStructureChangeRequest"("approvedById");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_rejectedById_idx" ON "CoaStructureChangeRequest"("rejectedById");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequest_implementedById_idx" ON "CoaStructureChangeRequest"("implementedById");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequestAttachment_tenantId_idx" ON "CoaStructureChangeRequestAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequestAttachment_tenantId_requestId_idx" ON "CoaStructureChangeRequestAttachment"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "CoaStructureChangeRequestAttachment_uploadedById_idx" ON "CoaStructureChangeRequestAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_coaStructureFrozenByUserId_fkey" FOREIGN KEY ("coaStructureFrozenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequest" ADD CONSTRAINT "CoaStructureChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequest" ADD CONSTRAINT "CoaStructureChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequest" ADD CONSTRAINT "CoaStructureChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequest" ADD CONSTRAINT "CoaStructureChangeRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequest" ADD CONSTRAINT "CoaStructureChangeRequest_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequestAttachment" ADD CONSTRAINT "CoaStructureChangeRequestAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequestAttachment" ADD CONSTRAINT "CoaStructureChangeRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoaStructureChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaStructureChangeRequestAttachment" ADD CONSTRAINT "CoaStructureChangeRequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
