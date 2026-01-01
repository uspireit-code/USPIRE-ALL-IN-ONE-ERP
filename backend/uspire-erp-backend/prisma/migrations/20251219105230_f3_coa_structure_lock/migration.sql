-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'COA_HIERARCHY_CHANGE';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_LOCKED';
ALTER TYPE "AuditEventType" ADD VALUE 'COA_UNLOCKED';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "hierarchyPath" TEXT,
ADD COLUMN     "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPostingAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "normalBalance" "NormalBalance" NOT NULL DEFAULT 'DEBIT';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "coaLockedAt" TIMESTAMP(3);
