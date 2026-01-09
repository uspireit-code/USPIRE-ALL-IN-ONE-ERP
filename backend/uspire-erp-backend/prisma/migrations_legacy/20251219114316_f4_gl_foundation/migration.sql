/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,journalNumber]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('STANDARD', 'ADJUSTING', 'ACCRUAL', 'REVERSING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'JOURNAL_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'JOURNAL_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE 'JOURNAL_PARK';
ALTER TYPE "AuditEventType" ADD VALUE 'JOURNAL_REVERSE';

-- AlterEnum
ALTER TYPE "JournalStatus" ADD VALUE 'PARKED';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "journalNumber" INTEGER,
ADD COLUMN     "journalType" "JournalType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "periodId" TEXT,
ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "description" TEXT,
ADD COLUMN     "lineNumber" INTEGER;

-- CreateTable
CREATE TABLE "TenantSequenceCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantSequenceCounter_tenantId_idx" ON "TenantSequenceCounter"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSequenceCounter_tenantId_name_key" ON "TenantSequenceCounter"("tenantId", "name");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_journalType_idx" ON "JournalEntry"("tenantId", "journalType");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_periodId_idx" ON "JournalEntry"("tenantId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_journalNumber_key" ON "JournalEntry"("tenantId", "journalNumber");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_lineNumber_idx" ON "JournalLine"("journalEntryId", "lineNumber");

-- AddForeignKey
ALTER TABLE "TenantSequenceCounter" ADD CONSTRAINT "TenantSequenceCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
