-- CreateEnum
CREATE TYPE "LegalEntityAccessLevel" AS ENUM ('VIEW', 'PREPARE', 'POST', 'APPROVE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "IntercompanyAccountRole" AS ENUM ('DUE_TO', 'DUE_FROM', 'INTERCOMPANY_CLEARING');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'JOURNAL_UPLOAD_BATCH';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "intercompanyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intercompanyRole" "IntercompanyAccountRole",
ADD COLUMN     "isIntercompanyAccount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditEvidence" ADD COLUMN     "auditSensitivity" TEXT,
ADD COLUMN     "evidenceCategory" TEXT,
ADD COLUMN     "governanceActionType" TEXT,
ADD COLUMN     "governanceDomain" TEXT,
ADD COLUMN     "justificationText" TEXT,
ADD COLUMN     "retentionClassification" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "retroPostToleranceDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuditEvidenceLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLegalEntityAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "accessLevel" "LegalEntityAccessLevel" NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canOverride" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserLegalEntityAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvidenceLink_tenantId_idx" ON "AuditEvidenceLink"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvidenceLink_tenantId_entityType_entityId_idx" ON "AuditEvidenceLink"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvidenceLink_tenantId_evidenceId_idx" ON "AuditEvidenceLink"("tenantId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvidenceLink_tenantId_evidenceId_entityType_entityId_key" ON "AuditEvidenceLink"("tenantId", "evidenceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "UserLegalEntityAccess_tenantId_idx" ON "UserLegalEntityAccess"("tenantId");

-- CreateIndex
CREATE INDEX "UserLegalEntityAccess_tenantId_userId_idx" ON "UserLegalEntityAccess"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "UserLegalEntityAccess_tenantId_legalEntityId_idx" ON "UserLegalEntityAccess"("tenantId", "legalEntityId");

-- CreateIndex
CREATE INDEX "UserLegalEntityAccess_expiresAt_idx" ON "UserLegalEntityAccess"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLegalEntityAccess_tenantId_userId_legalEntityId_key" ON "UserLegalEntityAccess"("tenantId", "userId", "legalEntityId");

-- AddForeignKey
ALTER TABLE "AuditEvidenceLink" ADD CONSTRAINT "AuditEvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "AuditEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvidenceLink" ADD CONSTRAINT "AuditEvidenceLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLegalEntityAccess" ADD CONSTRAINT "UserLegalEntityAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLegalEntityAccess" ADD CONSTRAINT "UserLegalEntityAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLegalEntityAccess" ADD CONSTRAINT "UserLegalEntityAccess_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLegalEntityAccess" ADD CONSTRAINT "UserLegalEntityAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
