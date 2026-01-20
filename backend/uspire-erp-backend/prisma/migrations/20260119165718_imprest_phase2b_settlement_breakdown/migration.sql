-- CreateEnum
CREATE TYPE "ImprestSettlementLineType" AS ENUM ('EXPENSE', 'CASH_RETURN');

-- CreateTable
CREATE TABLE "ImprestSettlementLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "ImprestSettlementLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "spentDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprestSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprestSettlementLine_tenantId_idx" ON "ImprestSettlementLine"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestSettlementLine_caseId_idx" ON "ImprestSettlementLine"("caseId");

-- CreateIndex
CREATE INDEX "ImprestSettlementLine_createdById_idx" ON "ImprestSettlementLine"("createdById");

-- CreateIndex
CREATE INDEX "ImprestSettlementLine_tenantId_createdAt_idx" ON "ImprestSettlementLine"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImprestSettlementLine" ADD CONSTRAINT "ImprestSettlementLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ImprestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestSettlementLine" ADD CONSTRAINT "ImprestSettlementLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestSettlementLine" ADD CONSTRAINT "ImprestSettlementLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
