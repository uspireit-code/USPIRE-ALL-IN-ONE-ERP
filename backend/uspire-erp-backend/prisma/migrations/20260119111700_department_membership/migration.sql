-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_tenantId_departmentId_userId_key" ON "DepartmentMembership"("tenantId", "departmentId", "userId");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_idx" ON "DepartmentMembership"("tenantId");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_departmentId_idx" ON "DepartmentMembership"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_userId_idx" ON "DepartmentMembership"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_status_idx" ON "DepartmentMembership"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_effectiveFrom_idx" ON "DepartmentMembership"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_effectiveTo_idx" ON "DepartmentMembership"("tenantId", "effectiveTo");

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
