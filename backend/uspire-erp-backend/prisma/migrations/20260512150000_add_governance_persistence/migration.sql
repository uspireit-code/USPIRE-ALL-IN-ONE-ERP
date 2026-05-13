-- CreateTable
CREATE TABLE "GovernanceOverrideSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "overrideCode" TEXT NOT NULL,
    "entryPoint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "escalationType" TEXT,
    "escalationReason" TEXT,
    "entityType" "AuditEntityType",
    "entityId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceOverrideSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceAutomationExecutionSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationCode" TEXT NOT NULL,
    "scheduleId" TEXT,
    "executionStatus" TEXT NOT NULL DEFAULT 'STARTED',
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "governanceDomain" TEXT,
    "severity" TEXT,
    "auditSensitivity" TEXT,
    "overrideSessionId" TEXT,
    "escalationType" TEXT,
    "escalationReason" TEXT,
    "evidenceMetadata" JSONB,
    "governanceMetadata" JSONB,
    "executionResult" JSONB,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceAutomationExecutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceAutomationSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationCode" TEXT NOT NULL,
    "scheduleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "scheduleConfig" JSONB,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "reviewRequiredAt" TIMESTAMP(3),
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "GovernanceAutomationSchedule_pkey" PRIMARY KEY ("id")
);

-- Indexes (GovernanceOverrideSession)
CREATE INDEX "GovernanceOverrideSession_tenantId_idx" ON "GovernanceOverrideSession"("tenantId");
CREATE INDEX "GovernanceOverrideSession_tenantId_overrideCode_idx" ON "GovernanceOverrideSession"("tenantId", "overrideCode");
CREATE INDEX "GovernanceOverrideSession_tenantId_status_idx" ON "GovernanceOverrideSession"("tenantId", "status");
CREATE INDEX "GovernanceOverrideSession_tenantId_expiresAt_idx" ON "GovernanceOverrideSession"("tenantId", "expiresAt");
CREATE INDEX "GovernanceOverrideSession_tenantId_requestedById_idx" ON "GovernanceOverrideSession"("tenantId", "requestedById");

-- Indexes (GovernanceAutomationExecutionSession)
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_idx" ON "GovernanceAutomationExecutionSession"("tenantId");
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_automationCode_idx" ON "GovernanceAutomationExecutionSession"("tenantId", "automationCode");
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_scheduleId_idx" ON "GovernanceAutomationExecutionSession"("tenantId", "scheduleId");
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_executionStatus_idx" ON "GovernanceAutomationExecutionSession"("tenantId", "executionStatus");
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_startedAt_idx" ON "GovernanceAutomationExecutionSession"("tenantId", "startedAt");
CREATE INDEX "GovernanceAutomationExecutionSession_tenantId_completedAt_idx" ON "GovernanceAutomationExecutionSession"("tenantId", "completedAt");
CREATE INDEX "GovernanceAutomationExecutionSession_overrideSessionId_idx" ON "GovernanceAutomationExecutionSession"("overrideSessionId");

-- Indexes (GovernanceAutomationSchedule)
CREATE INDEX "GovernanceAutomationSchedule_tenantId_idx" ON "GovernanceAutomationSchedule"("tenantId");
CREATE INDEX "GovernanceAutomationSchedule_tenantId_automationCode_idx" ON "GovernanceAutomationSchedule"("tenantId", "automationCode");
CREATE INDEX "GovernanceAutomationSchedule_tenantId_scheduleStatus_idx" ON "GovernanceAutomationSchedule"("tenantId", "scheduleStatus");
CREATE INDEX "GovernanceAutomationSchedule_tenantId_nextRunAt_idx" ON "GovernanceAutomationSchedule"("tenantId", "nextRunAt");
CREATE INDEX "GovernanceAutomationSchedule_tenantId_targetType_targetId_idx" ON "GovernanceAutomationSchedule"("tenantId", "targetType", "targetId");
CREATE INDEX "GovernanceAutomationSchedule_createdById_idx" ON "GovernanceAutomationSchedule"("createdById");

-- Foreign Keys (GovernanceOverrideSession)
ALTER TABLE "GovernanceOverrideSession" ADD CONSTRAINT "GovernanceOverrideSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceOverrideSession" ADD CONSTRAINT "GovernanceOverrideSession_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceOverrideSession" ADD CONSTRAINT "GovernanceOverrideSession_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernanceOverrideSession" ADD CONSTRAINT "GovernanceOverrideSession_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernanceOverrideSession" ADD CONSTRAINT "GovernanceOverrideSession_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys (GovernanceAutomationExecutionSession)
ALTER TABLE "GovernanceAutomationExecutionSession" ADD CONSTRAINT "GovernanceAutomationExecutionSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceAutomationExecutionSession" ADD CONSTRAINT "GovernanceAutomationExecutionSession_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernanceAutomationExecutionSession" ADD CONSTRAINT "GovernanceAutomationExecutionSession_overrideSessionId_fkey" FOREIGN KEY ("overrideSessionId") REFERENCES "GovernanceOverrideSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys (GovernanceAutomationSchedule)
ALTER TABLE "GovernanceAutomationSchedule" ADD CONSTRAINT "GovernanceAutomationSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceAutomationSchedule" ADD CONSTRAINT "GovernanceAutomationSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernanceAutomationSchedule" ADD CONSTRAINT "GovernanceAutomationSchedule_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernanceAutomationSchedule" ADD CONSTRAINT "GovernanceAutomationSchedule_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
