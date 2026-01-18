-- CreateEnum
CREATE TYPE "ImprestRiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ImprestFundingSourceType" AS ENUM ('BANK', 'CASH', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "ImprestFacilityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ImprestEvidenceType" AS ENUM ('REQUEST_SUPPORTING_DOC', 'FUNDING_PROOF', 'RECEIPT_BUNDLE', 'CASH_RETURN_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "ImprestCaseState" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ISSUANCE_PENDING_EVIDENCE', 'ISSUED', 'RETIREMENT_SUBMITTED', 'RETIREMENT_REVIEW', 'SETTLED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'IMPREST_TYPE_POLICY';
ALTER TYPE "AuditEntityType" ADD VALUE 'IMPREST_FACILITY';
ALTER TYPE "AuditEntityType" ADD VALUE 'IMPREST_CASE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_TYPE_POLICY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_TYPE_POLICY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_TYPE_POLICY_STATUS_CHANGE';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_FACILITY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_FACILITY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_FACILITY_STATUS_CHANGE';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_EVIDENCE_LINKED';
ALTER TYPE "AuditEventType" ADD VALUE 'IMPREST_CASE_ISSUED';

-- CreateTable
CREATE TABLE "ImprestTypePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultFloatLimit" DECIMAL(18,2) NOT NULL,
    "settlementDays" INTEGER NOT NULL,
    "receiptRule" TEXT NOT NULL,
    "receiptThresholdAmount" DECIMAL(18,2),
    "approvalStrength" TEXT NOT NULL,
    "defaultRiskRating" "ImprestRiskRating" NOT NULL DEFAULT 'MEDIUM',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprestTypePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprestFacility" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "typePolicyId" TEXT NOT NULL,
    "custodianUserId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "projectId" TEXT,
    "fundId" TEXT,
    "currency" TEXT NOT NULL,
    "approvedFloatLimit" DECIMAL(18,2) NOT NULL,
    "settlementDays" INTEGER NOT NULL,
    "fundingSourceType" "ImprestFundingSourceType" NOT NULL,
    "bankAccountId" TEXT,
    "riskRating" "ImprestRiskRating" NOT NULL,
    "controlGlAccountId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" "ImprestFacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprestFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprestCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "expectedSettlementDate" TIMESTAMP(3) NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "state" "ImprestCaseState" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "issuedJournalId" TEXT,

    CONSTRAINT "ImprestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprestCaseTransitionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromState" "ImprestCaseState" NOT NULL,
    "toState" "ImprestCaseState" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprestCaseTransitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprestCaseEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "type" "ImprestEvidenceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprestCaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprestTypePolicy_tenantId_idx" ON "ImprestTypePolicy"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestTypePolicy_tenantId_isActive_idx" ON "ImprestTypePolicy"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ImprestTypePolicy_createdById_idx" ON "ImprestTypePolicy"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ImprestTypePolicy_tenantId_name_effectiveFrom_key" ON "ImprestTypePolicy"("tenantId", "name", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ImprestFacility_tenantId_idx" ON "ImprestFacility"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestFacility_tenantId_status_idx" ON "ImprestFacility"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ImprestFacility_typePolicyId_idx" ON "ImprestFacility"("typePolicyId");

-- CreateIndex
CREATE INDEX "ImprestFacility_custodianUserId_idx" ON "ImprestFacility"("custodianUserId");

-- CreateIndex
CREATE INDEX "ImprestFacility_entityId_idx" ON "ImprestFacility"("entityId");

-- CreateIndex
CREATE INDEX "ImprestFacility_departmentId_idx" ON "ImprestFacility"("departmentId");

-- CreateIndex
CREATE INDEX "ImprestFacility_projectId_idx" ON "ImprestFacility"("projectId");

-- CreateIndex
CREATE INDEX "ImprestFacility_fundId_idx" ON "ImprestFacility"("fundId");

-- CreateIndex
CREATE INDEX "ImprestFacility_bankAccountId_idx" ON "ImprestFacility"("bankAccountId");

-- CreateIndex
CREATE INDEX "ImprestFacility_controlGlAccountId_idx" ON "ImprestFacility"("controlGlAccountId");

-- CreateIndex
CREATE INDEX "ImprestCase_tenantId_idx" ON "ImprestCase"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestCase_tenantId_state_idx" ON "ImprestCase"("tenantId", "state");

-- CreateIndex
CREATE INDEX "ImprestCase_facilityId_idx" ON "ImprestCase"("facilityId");

-- CreateIndex
CREATE INDEX "ImprestCase_createdById_idx" ON "ImprestCase"("createdById");

-- CreateIndex
CREATE INDEX "ImprestCase_reviewedById_idx" ON "ImprestCase"("reviewedById");

-- CreateIndex
CREATE INDEX "ImprestCase_approvedById_idx" ON "ImprestCase"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "ImprestCase_tenantId_reference_key" ON "ImprestCase"("tenantId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ImprestCase_tenantId_issuedJournalId_key" ON "ImprestCase"("tenantId", "issuedJournalId");

-- CreateIndex
CREATE INDEX "ImprestCaseTransitionLog_tenantId_idx" ON "ImprestCaseTransitionLog"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestCaseTransitionLog_caseId_idx" ON "ImprestCaseTransitionLog"("caseId");

-- CreateIndex
CREATE INDEX "ImprestCaseTransitionLog_actorUserId_idx" ON "ImprestCaseTransitionLog"("actorUserId");

-- CreateIndex
CREATE INDEX "ImprestCaseTransitionLog_tenantId_createdAt_idx" ON "ImprestCaseTransitionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ImprestCaseEvidence_tenantId_idx" ON "ImprestCaseEvidence"("tenantId");

-- CreateIndex
CREATE INDEX "ImprestCaseEvidence_caseId_idx" ON "ImprestCaseEvidence"("caseId");

-- CreateIndex
CREATE INDEX "ImprestCaseEvidence_evidenceId_idx" ON "ImprestCaseEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ImprestCaseEvidence_caseId_evidenceId_key" ON "ImprestCaseEvidence"("caseId", "evidenceId");

-- AddForeignKey
ALTER TABLE "ImprestTypePolicy" ADD CONSTRAINT "ImprestTypePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestTypePolicy" ADD CONSTRAINT "ImprestTypePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_typePolicyId_fkey" FOREIGN KEY ("typePolicyId") REFERENCES "ImprestTypePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_custodianUserId_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_controlGlAccountId_fkey" FOREIGN KEY ("controlGlAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestFacility" ADD CONSTRAINT "ImprestFacility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "ImprestFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_issuedJournalId_fkey" FOREIGN KEY ("issuedJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCase" ADD CONSTRAINT "ImprestCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseTransitionLog" ADD CONSTRAINT "ImprestCaseTransitionLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ImprestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseTransitionLog" ADD CONSTRAINT "ImprestCaseTransitionLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseTransitionLog" ADD CONSTRAINT "ImprestCaseTransitionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseEvidence" ADD CONSTRAINT "ImprestCaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ImprestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseEvidence" ADD CONSTRAINT "ImprestCaseEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "AuditEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprestCaseEvidence" ADD CONSTRAINT "ImprestCaseEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
