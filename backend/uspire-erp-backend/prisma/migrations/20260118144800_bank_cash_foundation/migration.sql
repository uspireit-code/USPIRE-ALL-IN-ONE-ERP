/*
  Warnings:

  - You are about to drop the column `isActive` on the `BankAccount` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "SupplierInvoice_tenantId_supplierId_invoiceNumber_key";

-- AlterTable
ALTER TABLE "BankAccount" DROP COLUMN "isActive",
ADD COLUMN     "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "BankAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "type" "BankAccountType" NOT NULL DEFAULT 'BANK',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "accountNumber" DROP NOT NULL;
