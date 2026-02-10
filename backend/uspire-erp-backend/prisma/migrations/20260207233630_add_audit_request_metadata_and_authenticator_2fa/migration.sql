-- AlterEnum
ALTER TYPE "TwoFactorMethod" ADD VALUE 'AUTHENTICATOR';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "userAgent" TEXT;
