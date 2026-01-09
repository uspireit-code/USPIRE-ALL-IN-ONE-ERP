-- Phase 5A: Add silent risk scoring fields to JournalEntry
ALTER TABLE "JournalEntry"
  ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "riskFlags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "riskComputedAt" TIMESTAMP(3);

-- Add audit event type for risk computation
ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_RISK_COMPUTED';
