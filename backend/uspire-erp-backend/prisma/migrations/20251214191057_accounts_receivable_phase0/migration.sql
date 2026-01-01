-- CreateEnum
CREATE TYPE "CustomerInvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoiceLine" (
    "id" TEXT NOT NULL,
    "customerInvoiceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_name_key" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CustomerInvoice_tenantId_idx" ON "CustomerInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "CustomerInvoice_tenantId_status_idx" ON "CustomerInvoice"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_tenantId_customerId_invoiceNumber_key" ON "CustomerInvoice"("tenantId", "customerId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_customerInvoiceId_idx" ON "CustomerInvoiceLine"("customerInvoiceId");

-- CreateIndex
CREATE INDEX "CustomerInvoiceLine_accountId_idx" ON "CustomerInvoiceLine"("accountId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_customerInvoiceId_fkey" FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoiceLine" ADD CONSTRAINT "CustomerInvoiceLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
