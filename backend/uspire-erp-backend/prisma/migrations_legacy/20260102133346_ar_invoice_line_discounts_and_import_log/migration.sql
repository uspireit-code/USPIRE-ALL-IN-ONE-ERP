-- AlterTable
ALTER TABLE "CustomerInvoiceLine" ADD COLUMN     "discountAmount" DECIMAL(18,2),
ADD COLUMN     "discountPercent" DECIMAL(18,6),
ADD COLUMN     "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "CustomerInvoiceImportLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,

    CONSTRAINT "CustomerInvoiceImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_tenantId_idx" ON "CustomerInvoiceImportLog"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_tenantId_processedAt_idx" ON "CustomerInvoiceImportLog"("tenantId", "processedAt");

-- CreateIndex
CREATE INDEX "CustomerInvoiceImportLog_processedById_idx" ON "CustomerInvoiceImportLog"("processedById");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoiceImportLog_tenantId_importId_key" ON "CustomerInvoiceImportLog"("tenantId", "importId");

-- AddForeignKey
ALTER TABLE "CustomerInvoiceImportLog" ADD CONSTRAINT "CustomerInvoiceImportLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceImportLog" ADD CONSTRAINT "CustomerInvoiceImportLog_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
