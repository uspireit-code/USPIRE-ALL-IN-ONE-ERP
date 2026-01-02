-- AlterTable
ALTER TABLE "CustomerInvoice" ADD COLUMN     "invoiceNote" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;
