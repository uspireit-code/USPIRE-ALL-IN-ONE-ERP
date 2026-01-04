-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "requiresDepartment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomerInvoiceLine" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "requiresDepartmentOnInvoices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresFundOnInvoices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresProjectOnInvoices" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_departmentId_idx" ON "CustomerInvoiceLine"("departmentId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_projectId_idx" ON "CustomerInvoiceLine"("projectId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_fundId_idx" ON "CustomerInvoiceLine"("fundId");

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
