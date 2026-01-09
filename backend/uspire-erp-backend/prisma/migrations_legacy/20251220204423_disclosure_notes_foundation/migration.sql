-- CreateEnum
CREATE TYPE "DisclosureNoteType" AS ENUM ('PPE_MOVEMENT', 'DEPRECIATION', 'TAX_RECONCILIATION', 'PROVISIONS', 'CONTINGENCIES');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'DISCLOSURE_NOTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'DISCLOSURE_NOTE_GENERATE';
ALTER TYPE "AuditEventType" ADD VALUE 'DISCLOSURE_NOTE_VIEW';

-- CreateTable
CREATE TABLE "DisclosureNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "noteType" "DisclosureNoteType" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisclosureNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureNoteLine" (
    "id" TEXT NOT NULL,
    "disclosureNoteId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "DisclosureNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_idx" ON "DisclosureNote"("tenantId");

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_accountingPeriodId_idx" ON "DisclosureNote"("tenantId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "DisclosureNote_tenantId_noteType_idx" ON "DisclosureNote"("tenantId", "noteType");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNote_tenantId_accountingPeriodId_noteType_key" ON "DisclosureNote"("tenantId", "accountingPeriodId", "noteType");

-- CreateIndex
CREATE INDEX "DisclosureNoteLine_disclosureNoteId_idx" ON "DisclosureNoteLine"("disclosureNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNoteLine_disclosureNoteId_rowKey_key" ON "DisclosureNoteLine"("disclosureNoteId", "rowKey");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureNoteLine_disclosureNoteId_orderIndex_key" ON "DisclosureNoteLine"("disclosureNoteId", "orderIndex");

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNote" ADD CONSTRAINT "DisclosureNote_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureNoteLine" ADD CONSTRAINT "DisclosureNoteLine_disclosureNoteId_fkey" FOREIGN KEY ("disclosureNoteId") REFERENCES "DisclosureNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
