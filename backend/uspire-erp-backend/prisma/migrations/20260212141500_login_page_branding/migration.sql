-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "loginPageBackgroundUrl" TEXT,
ADD COLUMN     "loginPageTitle" TEXT NOT NULL DEFAULT 'Enterprise Resource Planning System';
