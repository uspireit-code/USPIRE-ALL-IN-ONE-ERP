/*
  Warnings:

  - You are about to drop the column `isActive` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,customerCode]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "Customer_tenantId_name_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "isActive",
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "customerCode" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Customer_tenantId_name_idx" ON "Customer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_customerCode_key" ON "Customer"("tenantId", "customerCode");
