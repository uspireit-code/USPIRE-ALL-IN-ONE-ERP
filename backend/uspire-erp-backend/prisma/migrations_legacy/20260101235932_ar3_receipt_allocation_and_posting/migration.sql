/*
  Warnings:

  - Added the required column `tenantId` to the `CustomerReceiptLine` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'CUSTOMER_RECEIPT';

-- AlterTable
ALTER TABLE "CustomerInvoice" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "CustomerReceipt" ADD COLUMN     "glJournalId" TEXT,
ADD COLUMN     "postedByUserId" TEXT;

-- AlterTable
ALTER TABLE "CustomerReceiptLine" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "arControlAccountId" TEXT,
ADD COLUMN     "defaultBankClearingAccountId" TEXT;

-- CreateIndex
CREATE INDEX "CustomerReceiptLine_tenantId_idx" ON "CustomerReceiptLine"("tenantId");

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_glJournalId_fkey" FOREIGN KEY ("glJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_arControlAccountId_fkey" FOREIGN KEY ("arControlAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_defaultBankClearingAccountId_fkey" FOREIGN KEY ("defaultBankClearingAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
