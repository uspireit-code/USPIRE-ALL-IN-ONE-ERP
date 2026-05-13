-- Add lifecycle foundation fields to GovernanceAutomationSchedule

ALTER TABLE "GovernanceAutomationSchedule"
ADD COLUMN     "activationStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- Indexes
CREATE INDEX "GovernanceAutomationSchedule_tenantId_activationStatus_idx" ON "GovernanceAutomationSchedule"("tenantId", "activationStatus");
CREATE INDEX "GovernanceAutomationSchedule_approvedById_idx" ON "GovernanceAutomationSchedule"("approvedById");

-- Foreign Keys
ALTER TABLE "GovernanceAutomationSchedule" ADD CONSTRAINT "GovernanceAutomationSchedule_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
