-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "apControlAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_apControlAccountId_fkey" FOREIGN KEY ("apControlAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
