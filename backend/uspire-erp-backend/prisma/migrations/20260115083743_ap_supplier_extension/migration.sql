-- CreateEnum
CREATE TYPE "WithholdingProfile" AS ENUM ('NONE', 'STANDARD', 'SPECIAL');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "address" TEXT,
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'ZMW',
ADD COLUMN     "defaultPaymentTerms" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withholdingProfile" "WithholdingProfile" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBankAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currency" TEXT,
    "swiftCode" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierChangeLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "refId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierDocument_tenantId_supplierId_idx" ON "SupplierDocument"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_tenantId_supplierId_createdAt_idx" ON "SupplierDocument"("tenantId", "supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierBankAccount_tenantId_supplierId_idx" ON "SupplierBankAccount"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierBankAccount_tenantId_supplierId_isActive_idx" ON "SupplierBankAccount"("tenantId", "supplierId", "isActive");

-- CreateIndex
CREATE INDEX "SupplierChangeLog_tenantId_supplierId_createdAt_idx" ON "SupplierChangeLog"("tenantId", "supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierChangeLog_tenantId_supplierId_changeType_idx" ON "SupplierChangeLog"("tenantId", "supplierId", "changeType");

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBankAccount" ADD CONSTRAINT "SupplierBankAccount_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierChangeLog" ADD CONSTRAINT "SupplierChangeLog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
