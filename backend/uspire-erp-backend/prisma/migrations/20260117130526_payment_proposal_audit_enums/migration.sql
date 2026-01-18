-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'PAYMENT_PROPOSAL';
ALTER TYPE "AuditEntityType" ADD VALUE 'PAYMENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'REVIEW_PACK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'PAYMENT_PROPOSAL_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PAYMENT_PROPOSAL_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'PAYMENT_PROPOSAL_APPROVED';
