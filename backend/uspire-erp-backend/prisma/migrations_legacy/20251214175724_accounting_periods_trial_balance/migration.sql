-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "journalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_status_idx" ON "AccountingPeriod"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_name_key" ON "AccountingPeriod"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
