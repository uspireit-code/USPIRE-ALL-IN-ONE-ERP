-- CreateTable
CREATE TABLE "ReviewPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "zipSize" INTEGER NOT NULL,
    "zipSha256Hash" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_idx" ON "ReviewPack"("tenantId");

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_periodId_idx" ON "ReviewPack"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "ReviewPack_tenantId_createdAt_idx" ON "ReviewPack"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewPack_tenantId_storageKey_key" ON "ReviewPack"("tenantId", "storageKey");

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPack" ADD CONSTRAINT "ReviewPack_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
