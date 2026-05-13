import type { JournalType } from '@prisma/client';

import type { GovernanceDomainCode, GovernanceSensitivity } from './governance-domain-registry';
import type { GovernanceSeverity } from './governance-severity';
import type { GovernanceActionType } from './governance-action-registry';

export type EvidenceGovernanceEnforcementMode = 'BLOCK' | 'ESCALATE';

export type EvidenceAttachmentType =
  | 'PDF'
  | 'IMAGE'
  | 'SPREADSHEET'
  | 'CSV'
  | 'TEXT'
  | 'OTHER';

export type EvidenceRetentionClassification =
  | 'STANDARD'
  | 'FINANCIAL_AUDIT'
  | 'STATUTORY'
  | 'TAX'
  | 'PAYROLL'
  | 'INTERCOMPANY';

export type EvidenceCategory =
  | 'SUPPORTING_DOCUMENT'
  | 'OVERRIDE_SUPPORT'
  | 'INTERCOMPANY_SUPPORT'
  | 'OPENING_BALANCE_SUPPORT'
  | 'TAX_SUPPORT'
  | 'SYSTEM_OVERRIDE_SUPPORT';

export type EvidenceGovernanceRuleCode =
  | 'ADJUSTMENT_JOURNAL'
  | 'RETRO_POST_OVERRIDE'
  | 'PERIOD_REOPEN'
  | 'INTERCOMPANY_JOURNAL'
  | 'OVERRIDE_POSTING'
  | 'OPENING_BALANCE_IMPORT'
  | 'SYSTEM_OVERRIDE';

export interface EvidenceGovernanceRuleDefinition {
  ruleCode: EvidenceGovernanceRuleCode;
  displayName: string;
  description: string;

  governanceDomain: GovernanceDomainCode;
  governanceSensitivity: GovernanceSensitivity;

  requiredEvidence: boolean;
  minimumAttachmentCount: number;
  allowedAttachmentTypes: EvidenceAttachmentType[] | 'ANY';

  requiredJustification: boolean;

  retentionPolicy: {
    classification: EvidenceRetentionClassification;
    minimumRetentionDays?: number;
  };

  escalationRequired: boolean;

  applicableJournalTypes: JournalType[] | 'ANY';
  applicableGovernanceActions: GovernanceActionType[] | 'ANY';

  enforcementMode: EvidenceGovernanceEnforcementMode;

  severity: GovernanceSeverity;

  evidenceCategory: EvidenceCategory;

  requireEvidenceCategoryMetadata?: boolean;
}

export const EVIDENCE_GOVERNANCE_REGISTRY: Record<
  EvidenceGovernanceRuleCode,
  EvidenceGovernanceRuleDefinition
> = {
  ADJUSTMENT_JOURNAL: {
    ruleCode: 'ADJUSTMENT_JOURNAL',
    displayName: 'Adjustment journal evidence',
    description: 'Adjustment journals require supporting documentation and justification.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'HIGH',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET'],
    requiredJustification: true,
    retentionPolicy: { classification: 'FINANCIAL_AUDIT' },
    escalationRequired: false,
    applicableJournalTypes: ['ADJUSTING'],
    applicableGovernanceActions: ['JOURNAL_TYPE_EVIDENCE_REQUIRED'],
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    evidenceCategory: 'SUPPORTING_DOCUMENT',
  },

  RETRO_POST_OVERRIDE: {
    ruleCode: 'RETRO_POST_OVERRIDE',
    displayName: 'Retro post override evidence',
    description: 'Retro posting overrides require evidence and an explicit governance justification.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'CRITICAL',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET', 'CSV'],
    requiredJustification: true,
    retentionPolicy: { classification: 'FINANCIAL_AUDIT' },
    escalationRequired: true,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['RETRO_POSTING_OVERRIDE'],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    evidenceCategory: 'OVERRIDE_SUPPORT',
  },

  PERIOD_REOPEN: {
    ruleCode: 'PERIOD_REOPEN',
    displayName: 'Period reopen evidence',
    description: 'Reopening an accounting period is a critical action and requires evidence and justification.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'CRITICAL',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET'],
    requiredJustification: true,
    retentionPolicy: { classification: 'FINANCIAL_AUDIT' },
    escalationRequired: true,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['PERIOD_REOPEN'],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    evidenceCategory: 'OVERRIDE_SUPPORT',
  },

  INTERCOMPANY_JOURNAL: {
    ruleCode: 'INTERCOMPANY_JOURNAL',
    displayName: 'Intercompany journal evidence',
    description: 'Intercompany journals require support documentation (agreements, schedules, or reconciliation artifacts).',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'HIGH',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET'],
    requiredJustification: false,
    retentionPolicy: { classification: 'INTERCOMPANY' },
    escalationRequired: false,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['INTERCOMPANY_BALANCE_VIOLATION'],
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    evidenceCategory: 'INTERCOMPANY_SUPPORT',
    requireEvidenceCategoryMetadata: true,
  },

  OVERRIDE_POSTING: {
    ruleCode: 'OVERRIDE_POSTING',
    displayName: 'Override posting evidence',
    description: 'Posting overrides require evidence and justification.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'CRITICAL',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET'],
    requiredJustification: true,
    retentionPolicy: { classification: 'FINANCIAL_AUDIT' },
    escalationRequired: true,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['GL_JOURNAL_OVERRIDE_POST'],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    evidenceCategory: 'OVERRIDE_SUPPORT',
  },

  OPENING_BALANCE_IMPORT: {
    ruleCode: 'OPENING_BALANCE_IMPORT',
    displayName: 'Opening balance support evidence',
    description: 'Opening balances require onboarding/cutover evidence.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    governanceSensitivity: 'HIGH',
    requiredEvidence: true,
    minimumAttachmentCount: 1,
    allowedAttachmentTypes: ['PDF', 'IMAGE', 'SPREADSHEET', 'CSV'],
    requiredJustification: false,
    retentionPolicy: { classification: 'FINANCIAL_AUDIT' },
    escalationRequired: false,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['JOURNAL_TYPE_OPENING_BALANCE_POLICY_VIOLATION'],
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    evidenceCategory: 'OPENING_BALANCE_SUPPORT',
  },

  SYSTEM_OVERRIDE: {
    ruleCode: 'SYSTEM_OVERRIDE',
    displayName: 'System override evidence',
    description: 'System-level overrides require evidence and justification.',
    governanceDomain: 'SYSTEM_GOVERNANCE',
    governanceSensitivity: 'CRITICAL',
    requiredEvidence: true,
    minimumAttachmentCount: 2,
    allowedAttachmentTypes: ['PDF', 'IMAGE'],
    requiredJustification: true,
    retentionPolicy: { classification: 'STATUTORY' },
    escalationRequired: true,
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['ESCALATION_OVERRIDE'],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    evidenceCategory: 'SYSTEM_OVERRIDE_SUPPORT',
  },
};

export function getEvidenceGovernanceRule(
  code: EvidenceGovernanceRuleCode,
): EvidenceGovernanceRuleDefinition {
  return EVIDENCE_GOVERNANCE_REGISTRY[code];
}
