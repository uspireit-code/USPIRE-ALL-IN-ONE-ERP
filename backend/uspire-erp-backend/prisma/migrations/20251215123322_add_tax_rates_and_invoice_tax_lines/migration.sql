-- CreateEnum
CREATE TYPE "TaxRateType" AS ENUM ('OUTPUT', 'INPUT');

-- CreateEnum
CREATE TYPE "InvoiceTaxSourceType" AS ENUM ('SUPPLIER_INVOICE', 'CUSTOMER_INVOICE');

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "type" "TaxRateType" NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTaxLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "InvoiceTaxSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRate_tenantId_idx" ON "TaxRate"("tenantId");

-- CreateIndex
CREATE INDEX "TaxRate_glAccountId_idx" ON "TaxRate"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_tenantId_name_key" ON "TaxRate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_tenantId_idx" ON "InvoiceTaxLine"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_sourceType_sourceId_idx" ON "InvoiceTaxLine"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "InvoiceTaxLine_taxRateId_idx" ON "InvoiceTaxLine"("taxRateId");

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTaxLine" ADD CONSTRAINT "InvoiceTaxLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
