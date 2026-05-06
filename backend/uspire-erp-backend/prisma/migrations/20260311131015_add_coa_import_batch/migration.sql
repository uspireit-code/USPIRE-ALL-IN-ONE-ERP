-- CreateEnum
CREATE TYPE "CoaImportBatchStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "CoaImportBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CoaImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "accountCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "CoaImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoaImportBatch_batchId_key" ON "CoaImportBatch"("batchId");

-- CreateIndex
CREATE INDEX "CoaImportBatch_tenantId_idx" ON "CoaImportBatch"("tenantId");

-- CreateIndex
CREATE INDEX "CoaImportBatch_tenantId_status_idx" ON "CoaImportBatch"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CoaImportBatch_createdByUserId_idx" ON "CoaImportBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "CoaImportBatch_submittedByUserId_idx" ON "CoaImportBatch"("submittedByUserId");

-- CreateIndex
CREATE INDEX "CoaImportBatch_approvedByUserId_idx" ON "CoaImportBatch"("approvedByUserId");

-- CreateIndex
CREATE INDEX "Account_tenantId_importBatchId_idx" ON "Account"("tenantId", "importBatchId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CoaImportBatch"("batchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaImportBatch" ADD CONSTRAINT "CoaImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaImportBatch" ADD CONSTRAINT "CoaImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaImportBatch" ADD CONSTRAINT "CoaImportBatch_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaImportBatch" ADD CONSTRAINT "CoaImportBatch_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
