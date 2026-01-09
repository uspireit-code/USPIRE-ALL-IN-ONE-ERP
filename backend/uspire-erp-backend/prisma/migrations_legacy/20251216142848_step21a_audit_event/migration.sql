-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('JOURNAL_POST', 'PERIOD_CHECKLIST_COMPLETE', 'PERIOD_CLOSE', 'SOD_VIOLATION', 'AP_POST', 'AR_POST', 'FA_CAPITALIZE', 'FA_DEPRECIATION_RUN', 'FA_DISPOSE', 'BANK_RECONCILIATION_MATCH');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('JOURNAL_ENTRY', 'ACCOUNTING_PERIOD', 'ACCOUNTING_PERIOD_CHECKLIST_ITEM', 'SUPPLIER_INVOICE', 'CUSTOMER_INVOICE', 'FIXED_ASSET', 'FIXED_ASSET_DEPRECIATION_RUN', 'BANK_RECONCILIATION_MATCH', 'USER');

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "permissionUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_userId_idx" ON "AuditEvent"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
