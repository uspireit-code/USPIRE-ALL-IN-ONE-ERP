/*
  Warnings:

  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'USER_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'USER_STATUS_CHANGE';
ALTER TYPE "AuditEventType" ADD VALUE 'USER_ROLE_ASSIGN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;

UPDATE "User"
SET "name" = COALESCE(NULLIF(split_part("email", '@', 1), ''), 'User')
WHERE "name" IS NULL;

ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
