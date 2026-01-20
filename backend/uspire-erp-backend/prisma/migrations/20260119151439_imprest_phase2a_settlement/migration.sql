-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_SETTLED';

-- AlterTable
ALTER TABLE "ImprestCase" ADD COLUMN     "settlementDate" TIMESTAMP(3);
