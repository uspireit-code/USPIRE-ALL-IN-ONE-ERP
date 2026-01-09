-- CreateTable
CREATE TABLE "AccountingPeriodChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_tenantId_idx" ON "AccountingPeriodChecklistItem"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_periodId_idx" ON "AccountingPeriodChecklistItem"("periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodChecklistItem_completedById_idx" ON "AccountingPeriodChecklistItem"("completedById");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriodChecklistItem_tenantId_periodId_code_key" ON "AccountingPeriodChecklistItem"("tenantId", "periodId", "code");

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodChecklistItem" ADD CONSTRAINT "AccountingPeriodChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
