-- CreateTable
CREATE TABLE "SoDRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "forbiddenPermissionA" TEXT NOT NULL,
    "forbiddenPermissionB" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoDRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoDViolationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionAttempted" TEXT NOT NULL,
    "conflictingPermission" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoDViolationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoDRule_tenantId_idx" ON "SoDRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SoDRule_tenantId_forbiddenPermissionA_forbiddenPermissionB_key" ON "SoDRule"("tenantId", "forbiddenPermissionA", "forbiddenPermissionB");

-- CreateIndex
CREATE INDEX "SoDViolationLog_tenantId_idx" ON "SoDViolationLog"("tenantId");

-- CreateIndex
CREATE INDEX "SoDViolationLog_userId_idx" ON "SoDViolationLog"("userId");

-- AddForeignKey
ALTER TABLE "SoDRule" ADD CONSTRAINT "SoDRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDViolationLog" ADD CONSTRAINT "SoDViolationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDViolationLog" ADD CONSTRAINT "SoDViolationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
