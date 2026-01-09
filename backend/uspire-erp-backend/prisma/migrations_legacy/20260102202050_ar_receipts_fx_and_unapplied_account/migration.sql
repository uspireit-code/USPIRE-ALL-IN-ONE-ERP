-- AlterTable
ALTER TABLE "CustomerReceipt" ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "unappliedReceiptsAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_unappliedReceiptsAccountId_fkey" FOREIGN KEY ("unappliedReceiptsAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
