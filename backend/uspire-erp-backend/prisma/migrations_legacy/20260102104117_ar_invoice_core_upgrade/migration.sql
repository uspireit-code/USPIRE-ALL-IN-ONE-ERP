/*
  Warnings:

  - The values [SUBMITTED,APPROVED] on the enum `CustomerInvoiceStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `approvedAt` on the `CustomerInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `approvedById` on the `CustomerInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `CustomerInvoiceLine` table. All the data in the column will be lost.
  - Added the required column `subtotal` to the `CustomerInvoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxAmount` to the `CustomerInvoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lineTotal` to the `CustomerInvoiceLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `CustomerInvoiceLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPrice` to the `CustomerInvoiceLine` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerInvoiceStatus_new" AS ENUM ('DRAFT', 'POSTED');
ALTER TABLE "CustomerInvoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CustomerInvoice" ALTER COLUMN "status" TYPE "CustomerInvoiceStatus_new" USING ("status"::text::"CustomerInvoiceStatus_new");
ALTER TYPE "CustomerInvoiceStatus" RENAME TO "CustomerInvoiceStatus_old";
ALTER TYPE "CustomerInvoiceStatus_new" RENAME TO "CustomerInvoiceStatus";
DROP TYPE "CustomerInvoiceStatus_old";
ALTER TABLE "CustomerInvoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "CustomerInvoice" DROP CONSTRAINT "CustomerInvoice_approvedById_fkey";

-- AlterTable
ALTER TABLE "CustomerInvoice" DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "subtotal" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(18,2) NOT NULL,
ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomerInvoiceLine" DROP COLUMN "amount",
ADD COLUMN     "lineTotal" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "quantity" DECIMAL(18,6) NOT NULL,
ADD COLUMN     "unitPrice" DECIMAL(18,6) NOT NULL;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
