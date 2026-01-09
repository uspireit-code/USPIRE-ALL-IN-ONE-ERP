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
DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."CustomerCreditNote"') IS NOT NULL THEN
    ALTER TABLE "CustomerCreditNote" DROP CONSTRAINT IF EXISTS "CustomerCreditNote_originalInvoiceId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."CustomerCreditNoteLine"') IS NOT NULL THEN
    ALTER TABLE "CustomerCreditNoteLine" DROP CONSTRAINT IF EXISTS "CustomerCreditNoteLine_taxRateId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_createdById_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_creditNoteId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_customerId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_postedById_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_receiptId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('public."Refund"') IS NOT NULL THEN
    ALTER TABLE "Refund" DROP CONSTRAINT IF EXISTS "Refund_tenantId_fkey";
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNote_customerId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNote_originalInvoiceId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNote_tenantId_customerId_creditNoteNumber_key";

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNote_tenantId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNote_tenantId_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "CustomerCreditNoteLine_taxRateId_idx";

-- Ensure CustomerCreditNote table exists for shadow DB replays
CREATE TABLE IF NOT EXISTS "CustomerCreditNote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "creditNoteNumber" TEXT NOT NULL,
  "creditNoteDate" TIMESTAMP(3) NOT NULL,
  "customerId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "currency" TEXT NOT NULL,
  "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "postedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCreditNote_pkey" PRIMARY KEY ("id")
);

-- Best-effort reshape for existing DBs
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "creditNoteNumber" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "creditNoteDate" TIMESTAMP(3);
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0;
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(18,2);
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(18,2);
ALTER TABLE "CustomerCreditNote" ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "CustomerCreditNote" DROP COLUMN IF EXISTS "originalInvoiceId";
ALTER TABLE "CustomerCreditNote" DROP COLUMN IF EXISTS "postedAt";
ALTER TABLE "CustomerCreditNote" DROP COLUMN IF EXISTS "reason";
ALTER TABLE "CustomerCreditNote" DROP COLUMN IF EXISTS "vatAmount";

-- Ensure CustomerCreditNoteLine table exists for shadow DB replays
CREATE TABLE IF NOT EXISTS "CustomerCreditNoteLine" (
  "id" TEXT NOT NULL,
  "creditNoteId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,2) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineAmount" DECIMAL(18,2) NOT NULL,
  "revenueAccountId" TEXT NOT NULL,
  "departmentId" TEXT,
  "projectId" TEXT,
  "fundId" TEXT,
  CONSTRAINT "CustomerCreditNoteLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "fundId" TEXT;
ALTER TABLE "CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "lineAmount" DECIMAL(18,2);
ALTER TABLE "CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "CustomerCreditNoteLine" ADD COLUMN IF NOT EXISTS "revenueAccountId" TEXT;

ALTER TABLE "CustomerCreditNoteLine" DROP COLUMN IF EXISTS "netAmount";
ALTER TABLE "CustomerCreditNoteLine" DROP COLUMN IF EXISTS "taxRateId";
ALTER TABLE "CustomerCreditNoteLine" DROP COLUMN IF EXISTS "vatAmount";

ALTER TABLE "CustomerCreditNoteLine" ALTER COLUMN "quantity" TYPE DECIMAL(18,2);
ALTER TABLE "CustomerCreditNoteLine" ALTER COLUMN "unitPrice" TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- DropTable
DROP TABLE IF EXISTS "Refund";

-- DropEnum
DROP TYPE IF EXISTS "CustomerCreditNoteStatus";

-- DropEnum
DROP TYPE IF EXISTS "RefundStatus";

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerRefund" (
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
CREATE INDEX IF NOT EXISTS "CustomerRefund_tenantId_refundNumber_idx" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerRefund_tenantId_customerId_idx" ON "CustomerRefund"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerRefund_tenantId_refundNumber_key" ON "CustomerRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_creditNoteNumber_idx" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_customerId_idx" ON "CustomerCreditNote"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_invoiceId_idx" ON "CustomerCreditNote"("tenantId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerCreditNote_tenantId_creditNoteNumber_key" ON "CustomerCreditNote"("tenantId", "creditNoteNumber");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNote" ADD CONSTRAINT "CustomerCreditNote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerCreditNoteLine" ADD CONSTRAINT "CustomerCreditNoteLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CustomerCreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomerRefund" ADD CONSTRAINT "CustomerRefund_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
