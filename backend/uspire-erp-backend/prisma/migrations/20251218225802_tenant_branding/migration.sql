-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'TENANT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'ORGANISATION_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE 'ORGANISATION_LOGO_UPLOAD';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "organisationName" TEXT NOT NULL DEFAULT 'USPIRE ERP',
ADD COLUMN     "organisationShortName" TEXT,
ADD COLUMN     "primaryColor" TEXT NOT NULL DEFAULT '#020445',
ADD COLUMN     "secondaryColor" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
