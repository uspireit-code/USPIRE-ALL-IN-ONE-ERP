-- CreateEnum
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'BLOCKED', 'RETIRED');

-- CreateEnum
CREATE TYPE "COAApprovalRequestType" AS ENUM ('CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'STATUS_CHANGE', 'RECLASSIFICATION');

-- CreateEnum
CREATE TYPE "COAApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "COAReclassificationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'COA_APPROVAL_REQUEST';
ALTER TYPE "AuditEntityType" ADD VALUE 'COA_RECLASSIFICATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STATUS_CHANGE_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_STATUS_CHANGE_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_UPDATE_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_RECLASS_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_RECLASS_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_RECLASS_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_RECLASS_REJECTED';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "changeReason" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "retiredAt" TIMESTAMP(3),
ADD COLUMN     "retiredById" TEXT,
ADD COLUMN     "status" "AccountLifecycleStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "COAApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestType" "COAApprovalRequestType" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "COAApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "COAApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COAApprovalAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "COAApprovalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COAReclassification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "newParentAccountId" TEXT,
    "newIfrsMappingCode" TEXT,
    "newFsMappingLevel1" TEXT,
    "newFsMappingLevel2" TEXT,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "COAReclassificationStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "COAReclassification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "COAApprovalRequest_tenantId_idx" ON "COAApprovalRequest"("tenantId");

-- CreateIndex
CREATE INDEX "COAApprovalRequest_tenantId_status_idx" ON "COAApprovalRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "COAApprovalRequest_tenantId_entityType_entityId_idx" ON "COAApprovalRequest"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "COAApprovalRequest_tenantId_requestedAt_idx" ON "COAApprovalRequest"("tenantId", "requestedAt");

-- CreateIndex
CREATE INDEX "COAApprovalRequest_requestedById_idx" ON "COAApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "COAApprovalAttachment_tenantId_idx" ON "COAApprovalAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "COAApprovalAttachment_tenantId_requestId_idx" ON "COAApprovalAttachment"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "COAApprovalAttachment_uploadedById_idx" ON "COAApprovalAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "COAReclassification_tenantId_idx" ON "COAReclassification"("tenantId");

-- CreateIndex
CREATE INDEX "COAReclassification_tenantId_accountId_idx" ON "COAReclassification"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "COAReclassification_tenantId_status_idx" ON "COAReclassification"("tenantId", "status");

-- CreateIndex
CREATE INDEX "COAReclassification_tenantId_effectiveStartDate_idx" ON "COAReclassification"("tenantId", "effectiveStartDate");

-- CreateIndex
CREATE INDEX "COAReclassification_requestedById_idx" ON "COAReclassification"("requestedById");

-- CreateIndex
CREATE INDEX "Account_tenantId_status_idx" ON "Account"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_retiredById_fkey" FOREIGN KEY ("retiredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalRequest" ADD CONSTRAINT "COAApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalRequest" ADD CONSTRAINT "COAApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalRequest" ADD CONSTRAINT "COAApprovalRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalRequest" ADD CONSTRAINT "COAApprovalRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalAttachment" ADD CONSTRAINT "COAApprovalAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalAttachment" ADD CONSTRAINT "COAApprovalAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "COAApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAApprovalAttachment" ADD CONSTRAINT "COAApprovalAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_newParentAccountId_fkey" FOREIGN KEY ("newParentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COAReclassification" ADD CONSTRAINT "COAReclassification_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
