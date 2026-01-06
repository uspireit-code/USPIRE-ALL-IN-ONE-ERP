-- CreateTable
CREATE TABLE "InvoiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revenueAccountId" TEXT NOT NULL,
    "requiresProject" BOOLEAN NOT NULL DEFAULT false,
    "requiresFund" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CustomerInvoice" ADD COLUMN     "invoiceCategoryId" TEXT,
ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceCategory_tenantId_idx" ON "InvoiceCategory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCategory_tenantId_code_key" ON "InvoiceCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CustomerInvoice_invoiceCategoryId_idx" ON "CustomerInvoice"("invoiceCategoryId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_fundId_idx" ON "CustomerInvoice"("fundId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_departmentId_idx" ON "CustomerInvoice"("departmentId");

-- AddForeignKey
ALTER TABLE "InvoiceCategory" ADD CONSTRAINT "InvoiceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCategory" ADD CONSTRAINT "InvoiceCategory_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_invoiceCategoryId_fkey" FOREIGN KEY ("invoiceCategoryId") REFERENCES "InvoiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
