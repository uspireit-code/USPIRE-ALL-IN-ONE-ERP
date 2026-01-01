-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'EVIDENCE_UPLOAD';

-- CreateTable
CREATE TABLE "AuditEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_idx" ON "AuditEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_entityType_entityId_idx" ON "AuditEvidence"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvidence_uploadedById_idx" ON "AuditEvidence"("uploadedById");

-- CreateIndex
CREATE INDEX "AuditEvidence_tenantId_createdAt_idx" ON "AuditEvidence"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvidence_tenantId_storageKey_key" ON "AuditEvidence"("tenantId", "storageKey");

-- AddForeignKey
ALTER TABLE "AuditEvidence" ADD CONSTRAINT "AuditEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvidence" ADD CONSTRAINT "AuditEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
