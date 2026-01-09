-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('DRAFT', 'CAPITALIZED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "FixedAssetDepreciationRunStatus" AS ENUM ('POSTED');

-- CreateTable
CREATE TABLE "FixedAssetCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "defaultUsefulLifeMonths" INTEGER NOT NULL,
    "defaultResidualRate" DECIMAL(7,4),
    "assetAccountId" TEXT NOT NULL,
    "accumDepAccountId" TEXT NOT NULL,
    "depExpenseAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "capitalizationDate" TIMESTAMP(3),
    "cost" DECIMAL(18,2) NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "assetAccountId" TEXT,
    "accumDepAccountId" TEXT,
    "depExpenseAccountId" TEXT,
    "vendorId" TEXT,
    "apInvoiceId" TEXT,
    "capitalizationJournalId" TEXT,
    "disposalJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT NOT NULL,
    "status" "FixedAssetDepreciationRunStatus" NOT NULL DEFAULT 'POSTED',
    "journalEntryId" TEXT,

    CONSTRAINT "FixedAssetDepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciationLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAssetDepreciationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAssetCategory_tenantId_idx" ON "FixedAssetCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetCategory_tenantId_code_key" ON "FixedAssetCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_idx" ON "FixedAsset"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAsset_tenantId_status_idx" ON "FixedAsset"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_categoryId_idx" ON "FixedAsset"("categoryId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationRun_tenantId_idx" ON "FixedAssetDepreciationRun"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationRun_periodId_idx" ON "FixedAssetDepreciationRun"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciationRun_tenantId_periodId_key" ON "FixedAssetDepreciationRun"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_tenantId_idx" ON "FixedAssetDepreciationLine"("tenantId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_runId_idx" ON "FixedAssetDepreciationLine"("runId");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciationLine_assetId_idx" ON "FixedAssetDepreciationLine"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciationLine_tenantId_runId_assetId_key" ON "FixedAssetDepreciationLine"("tenantId", "runId", "assetId");

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_accumDepAccountId_fkey" FOREIGN KEY ("accumDepAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_depExpenseAccountId_fkey" FOREIGN KEY ("depExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FixedAssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_accumDepAccountId_fkey" FOREIGN KEY ("accumDepAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_depExpenseAccountId_fkey" FOREIGN KEY ("depExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_apInvoiceId_fkey" FOREIGN KEY ("apInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_capitalizationJournalId_fkey" FOREIGN KEY ("capitalizationJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_disposalJournalId_fkey" FOREIGN KEY ("disposalJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationRun" ADD CONSTRAINT "FixedAssetDepreciationRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FixedAssetDepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDepreciationLine" ADD CONSTRAINT "FixedAssetDepreciationLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
