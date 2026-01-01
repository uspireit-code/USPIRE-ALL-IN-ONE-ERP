-- CreateEnum
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'FORECAST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_CREATE';
ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_UPDATE';
ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_SUBMIT';
ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_APPROVE';
ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_SUPERSEDE';
ALTER TYPE "AuditEventType" ADD VALUE 'FORECAST_VIEW';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "forecastId" TEXT,
ADD COLUMN     "forecastVersionId" TEXT;

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastVersion" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastLine" (
    "id" TEXT NOT NULL,
    "forecastVersionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ForecastLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Forecast_tenantId_idx" ON "Forecast"("tenantId");

-- CreateIndex
CREATE INDEX "Forecast_tenantId_fiscalYear_idx" ON "Forecast"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "Forecast_createdById_idx" ON "Forecast"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_tenantId_fiscalYear_key" ON "Forecast"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ForecastVersion_forecastId_idx" ON "ForecastVersion"("forecastId");

-- CreateIndex
CREATE INDEX "ForecastVersion_createdById_idx" ON "ForecastVersion"("createdById");

-- CreateIndex
CREATE INDEX "ForecastVersion_forecastId_status_idx" ON "ForecastVersion"("forecastId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastVersion_forecastId_versionNumber_key" ON "ForecastVersion"("forecastId", "versionNumber");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_idx" ON "ForecastLine"("forecastVersionId");

-- CreateIndex
CREATE INDEX "ForecastLine_accountId_idx" ON "ForecastLine"("accountId");

-- CreateIndex
CREATE INDEX "ForecastLine_forecastVersionId_month_idx" ON "ForecastLine"("forecastVersionId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastLine_forecastVersionId_accountId_month_key" ON "ForecastLine"("forecastVersionId", "accountId", "month");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_forecastId_idx" ON "AuditEvent"("tenantId", "forecastId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_forecastVersionId_idx" ON "AuditEvent"("tenantId", "forecastVersionId");

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forecast" ADD CONSTRAINT "Forecast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastVersion" ADD CONSTRAINT "ForecastVersion_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastVersion" ADD CONSTRAINT "ForecastVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_forecastVersionId_fkey" FOREIGN KEY ("forecastVersionId") REFERENCES "ForecastVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
