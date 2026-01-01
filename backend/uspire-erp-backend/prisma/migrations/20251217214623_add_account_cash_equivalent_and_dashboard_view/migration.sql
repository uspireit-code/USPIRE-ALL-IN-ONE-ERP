-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'DASHBOARD_VIEW';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "isCashEquivalent" BOOLEAN NOT NULL DEFAULT false;
