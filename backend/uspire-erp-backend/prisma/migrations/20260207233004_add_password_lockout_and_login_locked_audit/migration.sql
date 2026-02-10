-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'AUTH_LOGIN_LOCKED';

-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_userId_fkey";

-- AlterTable
ALTER TABLE "AuditEvent" ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordLockUntil" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
