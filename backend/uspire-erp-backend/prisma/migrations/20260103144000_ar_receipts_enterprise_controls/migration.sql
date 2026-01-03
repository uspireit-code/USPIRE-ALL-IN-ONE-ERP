-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "allowSelfPosting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "receiptBankName" TEXT,
ADD COLUMN     "receiptBankAccountName" TEXT,
ADD COLUMN     "receiptBankAccountNumber" TEXT,
ADD COLUMN     "receiptBankBranch" TEXT,
ADD COLUMN     "receiptBankSwiftCode" TEXT;
