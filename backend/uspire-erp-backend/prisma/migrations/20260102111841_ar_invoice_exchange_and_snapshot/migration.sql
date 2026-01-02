-- AlterTable
ALTER TABLE "CustomerInvoice" ADD COLUMN     "customerBillingAddressSnapshot" TEXT,
ADD COLUMN     "customerEmailSnapshot" TEXT,
ADD COLUMN     "customerNameSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
