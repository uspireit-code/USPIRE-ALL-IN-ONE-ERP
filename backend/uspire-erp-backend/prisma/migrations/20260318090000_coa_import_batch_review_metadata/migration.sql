-- AlterTable
ALTER TABLE "CoaImportBatch" ADD COLUMN     "sourceFileName" TEXT;
ALTER TABLE "CoaImportBatch" ADD COLUMN     "reviewedAt" TIMESTAMP(3);
ALTER TABLE "CoaImportBatch" ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "CoaImportBatch_reviewedByUserId_idx" ON "CoaImportBatch"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "CoaImportBatch" ADD CONSTRAINT "CoaImportBatch_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
