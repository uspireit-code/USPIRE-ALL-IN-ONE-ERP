/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,code]` on the table `AccountingPeriod` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountingPeriodType" AS ENUM ('OPENING', 'NORMAL');

-- AlterEnum
ALTER TYPE "AccountingPeriodStatus" ADD VALUE 'SOFT_CLOSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'PERIOD_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PERIOD_REOPENED';

-- DropIndex
DROP INDEX "AccountingPeriod_tenantId_name_key";

-- AlterTable
ALTER TABLE "AccountingPeriod" ADD COLUMN     "code" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "type" "AccountingPeriodType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_type_idx" ON "AccountingPeriod"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AccountingPeriod_createdById_idx" ON "AccountingPeriod"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_code_key" ON "AccountingPeriod"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
