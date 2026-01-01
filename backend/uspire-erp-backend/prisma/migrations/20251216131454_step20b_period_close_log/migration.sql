-- CreateTable
CREATE TABLE "AccountingPeriodCloseLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT,
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriodCloseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_tenantId_idx" ON "AccountingPeriodCloseLog"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_periodId_idx" ON "AccountingPeriodCloseLog"("periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriodCloseLog_userId_idx" ON "AccountingPeriodCloseLog"("userId");

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriodCloseLog" ADD CONSTRAINT "AccountingPeriodCloseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
