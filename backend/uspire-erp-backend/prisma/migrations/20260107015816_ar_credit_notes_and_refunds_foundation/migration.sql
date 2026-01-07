/*
  Warnings:

  - You are about to drop the column `originalInvoiceId` on the `CustomerCreditNote` table. All the data in the column will be lost.
  - You are about to drop the column `postedAt` on the `CustomerCreditNote` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `CustomerCreditNote` table. All the data in the column will be lost.
  - You are about to drop the column `vatAmount` on the `CustomerCreditNote` table. All the data in the column will be lost.
  - The `status` column on the `CustomerCreditNote` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `netAmount` on the `CustomerCreditNoteLine` table. All the data in the column will be lost.
  - You are about to drop the column `taxRateId` on the `CustomerCreditNoteLine` table. All the data in the column will be lost.
  - You are about to drop the column `vatAmount` on the `CustomerCreditNoteLine` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `CustomerCreditNoteLine` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,6)` to `Decimal(18,2)`.
  - You are about to alter the column `unitPrice` on the `CustomerCreditNoteLine` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,6)` to `Decimal(18,2)`.
  - You are about to drop the `Refund` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tenantId,creditNoteNumber]` on the table `CustomerCreditNote` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `CustomerCreditNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lineAmount` to the `CustomerCreditNoteLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revenueAccountId` to the `CustomerCreditNoteLine` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'VOID');

-- DropForeignKey
ALTER TABLE "CustomerCreditNote" DROP CONSTRAINT "CustomerCreditNote_originalInvoiceId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerCreditNoteLine" DROP CONSTRAINT "CustomerCreditNoteLine_taxRateId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_creditNoteId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_postedById_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_receiptId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_tenantId_fkey";

-- DropIndex
DROP INDEX "CustomerCreditNote_customerId_idx";

-- DropIndex
DROP INDEX "CustomerCreditNote_originalInvoiceId_idx";

-- DropIndex
DROP INDEX "CustomerCreditNote_tenantId_customerId_creditNoteNumber_key";

-- DropIndex
DROP INDEX "CustomerCreditNote_tenantId_idx";

-- DropIndex
DROP INDEX "CustomerCreditNote_tenantId_status_idx";

-- DropIndex
DROP INDEX "CustomerCreditNoteLine_taxRateId_idx";

-- AlterTable
ALTER TABLE "CustomerCreditNote" DROP COLUMN "originalInvoiceId",
DROP COLUMN "postedAt",
DROP COLUMN "reason",
DROP COLUMN "vatAmount",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "CustomerCreditNoteLine" DROP COLUMN "netAmount",
DROP COLUMN "taxRateId",
DROP COLUMN "vatAmount",
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "lineAmount" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "revenueAccountId" TEXT NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- DropTable
DROP TABLE "Refund";

-- DropEnum
DROP TYPE "CustomerCreditNoteStatus";

-- DropEnum
DROP TYPE "RefundStatus";

-- CreateTable
CREATE TABLE "CustomerRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiptId" TEXT,
    "creditNoteId" TEXT,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerRefund_tenantId_refundNumber_idx" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX "CustomerRefund_tenantId_customerId_idx" ON "CustomerRefund"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_tenantId_refundNumber_key" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_creditNoteNumber_idx" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_customerId_idx" ON "CustomerCreditNote"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerCreditNote_tenantId_invoiceId_idx" ON "CustomerCreditNote"("tenantId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditNote_tenantId_creditNoteNumber_key" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CustomerCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
