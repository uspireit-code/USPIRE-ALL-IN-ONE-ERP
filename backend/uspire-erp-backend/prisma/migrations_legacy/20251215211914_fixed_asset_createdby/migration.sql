/*
  Warnings:

  - Added the required column `createdById` to the `FixedAsset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FixedAsset" ADD COLUMN     "createdById" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "FixedAsset_createdById_idx" ON "FixedAsset"("createdById");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
