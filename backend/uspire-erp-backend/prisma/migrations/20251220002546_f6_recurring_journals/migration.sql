-- CreateEnum
CREATE TYPE "RecurringJournalFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'RECURRING_JOURNAL_TEMPLATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_TEMPLATE_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE 'RECURRING_JOURNAL_GENERATED';

-- CreateTable
CREATE TABLE "RecurringJournalTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "journalType" "JournalType" NOT NULL DEFAULT 'STANDARD',
    "referenceTemplate" TEXT NOT NULL,
    "descriptionTemplate" TEXT,
    "frequency" "RecurringJournalFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringJournalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringJournalTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "descriptionTemplate" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL,
    "creditAmount" DECIMAL(18,2) NOT NULL,
    "lineOrder" INTEGER NOT NULL,

    CONSTRAINT "RecurringJournalTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringJournalGeneration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "generatedJournalId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringJournalGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_idx" ON "RecurringJournalTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_isActive_idx" ON "RecurringJournalTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_tenantId_nextRunDate_idx" ON "RecurringJournalTemplate"("tenantId", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplate_createdById_idx" ON "RecurringJournalTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalTemplate_tenantId_name_key" ON "RecurringJournalTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplateLine_templateId_idx" ON "RecurringJournalTemplateLine"("templateId");

-- CreateIndex
CREATE INDEX "RecurringJournalTemplateLine_accountId_idx" ON "RecurringJournalTemplateLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalTemplateLine_templateId_lineOrder_key" ON "RecurringJournalTemplateLine"("templateId", "lineOrder");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_tenantId_idx" ON "RecurringJournalGeneration"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_tenantId_templateId_idx" ON "RecurringJournalGeneration"("tenantId", "templateId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_generatedJournalId_idx" ON "RecurringJournalGeneration"("generatedJournalId");

-- CreateIndex
CREATE INDEX "RecurringJournalGeneration_generatedById_idx" ON "RecurringJournalGeneration"("generatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournalGeneration_tenantId_templateId_runDate_key" ON "RecurringJournalGeneration"("tenantId", "templateId", "runDate");

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplate" ADD CONSTRAINT "RecurringJournalTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplate" ADD CONSTRAINT "RecurringJournalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplateLine" ADD CONSTRAINT "RecurringJournalTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringJournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalTemplateLine" ADD CONSTRAINT "RecurringJournalTemplateLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringJournalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_generatedJournalId_fkey" FOREIGN KEY ("generatedJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringJournalGeneration" ADD CONSTRAINT "RecurringJournalGeneration_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
