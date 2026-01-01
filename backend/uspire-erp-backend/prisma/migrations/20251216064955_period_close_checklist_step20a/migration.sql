-- CreateEnum
CREATE TYPE "PeriodCloseChecklistItemStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "PeriodCloseChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodCloseChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodCloseChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PeriodCloseChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodCloseChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklist_periodId_key" ON "PeriodCloseChecklist"("periodId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklist_tenantId_idx" ON "PeriodCloseChecklist"("tenantId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklist_periodId_idx" ON "PeriodCloseChecklist"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklist_tenantId_periodId_key" ON "PeriodCloseChecklist"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_tenantId_idx" ON "PeriodCloseChecklistItem"("tenantId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_checklistId_idx" ON "PeriodCloseChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "PeriodCloseChecklistItem_completedById_idx" ON "PeriodCloseChecklistItem"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodCloseChecklistItem_checklistId_code_key" ON "PeriodCloseChecklistItem"("checklistId", "code");

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklist" ADD CONSTRAINT "PeriodCloseChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklist" ADD CONSTRAINT "PeriodCloseChecklist_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "PeriodCloseChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodCloseChecklistItem" ADD CONSTRAINT "PeriodCloseChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
