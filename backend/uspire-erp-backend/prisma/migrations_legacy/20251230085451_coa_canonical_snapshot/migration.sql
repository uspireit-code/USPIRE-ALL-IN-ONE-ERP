-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "riskFlags" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "CoaCanonicalSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "fileName" TEXT,
    "format" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "hash" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "CoaCanonicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoaCanonicalSnapshot_tenantId_idx" ON "CoaCanonicalSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "CoaCanonicalSnapshot_uploadedAt_idx" ON "CoaCanonicalSnapshot"("uploadedAt");

-- AddForeignKey
ALTER TABLE "CoaCanonicalSnapshot" ADD CONSTRAINT "CoaCanonicalSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaCanonicalSnapshot" ADD CONSTRAINT "CoaCanonicalSnapshot_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
