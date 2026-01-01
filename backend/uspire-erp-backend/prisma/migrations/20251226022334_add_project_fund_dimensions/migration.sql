-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "requiresFund" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresProject" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "fundId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE INDEX "Project_tenantId_isActive_idx" ON "Project"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Project_tenantId_isRestricted_idx" ON "Project"("tenantId", "isRestricted");

-- CreateIndex
CREATE INDEX "Project_tenantId_effectiveFrom_idx" ON "Project"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Project_tenantId_effectiveTo_idx" ON "Project"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_code_key" ON "Project"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Fund_tenantId_idx" ON "Fund"("tenantId");

-- CreateIndex
CREATE INDEX "Fund_tenantId_projectId_idx" ON "Fund"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Fund_tenantId_isActive_idx" ON "Fund"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Fund_tenantId_effectiveFrom_idx" ON "Fund"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Fund_tenantId_effectiveTo_idx" ON "Fund"("tenantId", "effectiveTo");

-- CreateIndex
CREATE INDEX "Fund_createdById_idx" ON "Fund"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Fund_tenantId_code_key" ON "Fund"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalLine_projectId_idx" ON "JournalLine"("projectId");

-- CreateIndex
CREATE INDEX "JournalLine_fundId_idx" ON "JournalLine"("fundId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
