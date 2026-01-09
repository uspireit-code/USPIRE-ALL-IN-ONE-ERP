-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "legalEntityId" TEXT;

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_idx" ON "LegalEntity"("tenantId");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_isActive_idx" ON "LegalEntity"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_effectiveFrom_idx" ON "LegalEntity"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LegalEntity_tenantId_effectiveTo_idx" ON "LegalEntity"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "LegalEntity_createdById_idx" ON "LegalEntity"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_tenantId_code_key" ON "LegalEntity"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Department_tenantId_effectiveFrom_idx" ON "Department"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Department_tenantId_effectiveTo_idx" ON "Department"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Department_createdById_idx" ON "Department"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_code_key" ON "Department"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalLine_legalEntityId_idx" ON "JournalLine"("legalEntityId");

-- CreateIndex
CREATE INDEX "JournalLine_departmentId_idx" ON "JournalLine"("departmentId");

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
