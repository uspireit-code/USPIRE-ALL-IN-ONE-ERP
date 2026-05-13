import type { GovernanceDomainCode } from './governance-domain-registry';
import type { GovernanceSeverity } from './governance-severity';
import type { OverrideSeverity } from './override-severity';

export type OverrideApprovalMode = 'NONE' | 'MANUAL' | 'WORKFLOW_READY';

export type OverrideEntryPoint =
  | 'GL_JOURNAL_POST'
  | 'GL_JOURNAL_POST_OVERRIDE'
  | 'PERIOD_POSTING'
  | 'PERIOD_RETRO_POSTING'
  | 'INTERCOMPANY_GOVERNANCE'
  | 'EVIDENCE_GOVERNANCE'
  | 'COMBINATION_GOVERNANCE'
  | 'SECURITY_SOD'
  | 'FISCAL_GOVERNANCE'
  | 'OTHER';

export type OverrideCode =
  | 'PERIOD_SOFT_CLOSE_OVERRIDE'
  | 'RETRO_POSTING_OVERRIDE'
  | 'GL_POST_OVERRIDE'
  | 'INTERCOMPANY_OVERRIDE'
  | 'EVIDENCE_OVERRIDE'
  | 'COMBINATION_POLICY_OVERRIDE'
  | 'ENTITY_SCOPE_OVERRIDE'
  | 'SOD_OVERRIDE'
  | 'FISCAL_GOVERNANCE_OVERRIDE';

export interface OverrideGovernancePolicyDefinition {
  overrideCode: OverrideCode;
  displayName: string;
  description: string;

  governanceDomain: GovernanceDomainCode;
  severity: OverrideSeverity;
  auditSensitivity: GovernanceSeverity;

  escalationRequired: boolean;

  evidenceRequired: boolean;
  minimumEvidenceCount: number;

  allowedRoles: string[];

  approvalRequired: boolean;
  approvalMode: OverrideApprovalMode;

  maxDurationMinutes: number;
  expiryRequired: boolean;

  requiresReason: boolean;
  requiresJustification: boolean;
  requiresSecondaryReviewer: boolean;

  allowedEntryPoints: OverrideEntryPoint[] | 'ANY';

  automationAllowed: boolean;
}

export const OVERRIDE_GOVERNANCE_REGISTRY: Record<
  OverrideCode,
  OverrideGovernancePolicyDefinition
> = {
  PERIOD_SOFT_CLOSE_OVERRIDE: {
    overrideCode: 'PERIOD_SOFT_CLOSE_OVERRIDE',
    displayName: 'Posting in soft-closed period override',
    description: 'Allows posting when accounting period is SOFT_CLOSED under governed exception controls.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: false,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60 * 24,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: false,
    allowedEntryPoints: ['PERIOD_POSTING', 'GL_JOURNAL_POST', 'GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  RETRO_POSTING_OVERRIDE: {
    overrideCode: 'RETRO_POSTING_OVERRIDE',
    displayName: 'Retro posting tolerance override',
    description: 'Allows posting outside retro tolerance window under governed exception controls.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: false,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60 * 24,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: false,
    allowedEntryPoints: ['PERIOD_RETRO_POSTING', 'GL_JOURNAL_POST', 'GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  GL_POST_OVERRIDE: {
    overrideCode: 'GL_POST_OVERRIDE',
    displayName: 'GL journal post override',
    description: 'Allows a governed exception to post a journal when standard posting controls would block it.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: false,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: ['GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  INTERCOMPANY_OVERRIDE: {
    overrideCode: 'INTERCOMPANY_OVERRIDE',
    displayName: 'Intercompany governance override',
    description: 'Allows a governed exception for intercompany policy enforcement failures (requires explicit auditability).',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 2,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: ['INTERCOMPANY_GOVERNANCE', 'GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  EVIDENCE_OVERRIDE: {
    overrideCode: 'EVIDENCE_OVERRIDE',
    displayName: 'Evidence governance override',
    description: 'Allows a governed exception when evidence requirements are temporarily unmet (requires strict traceability).',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 30,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: ['EVIDENCE_GOVERNANCE', 'GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  COMBINATION_POLICY_OVERRIDE: {
    overrideCode: 'COMBINATION_POLICY_OVERRIDE',
    displayName: 'Account combination policy override',
    description: 'Allows a governed exception when combination governance would block a posting (requires reviewability).',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: ['COMBINATION_GOVERNANCE', 'GL_JOURNAL_POST_OVERRIDE'],
    automationAllowed: false,
  },

  ENTITY_SCOPE_OVERRIDE: {
    overrideCode: 'ENTITY_SCOPE_OVERRIDE',
    displayName: 'Legal entity scope override',
    description: 'Allows a governed exception to act across legal-entity scope boundaries (extremely sensitive).',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'CRITICAL',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 2,
    allowedRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 30,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: 'ANY',
    automationAllowed: false,
  },

  SOD_OVERRIDE: {
    overrideCode: 'SOD_OVERRIDE',
    displayName: 'Segregation of duties override',
    description: 'Allows a governed exception to proceed despite SoD conflicts (requires highest reviewability).',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'CRITICAL',
    auditSensitivity: 'CRITICAL',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 2,
    allowedRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 15,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: true,
    allowedEntryPoints: ['SECURITY_SOD'],
    automationAllowed: false,
  },

  FISCAL_GOVERNANCE_OVERRIDE: {
    overrideCode: 'FISCAL_GOVERNANCE_OVERRIDE',
    displayName: 'Fiscal governance override',
    description: 'Allows a governed exception for fiscal governance constraints under strict evidence and escalation.',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'HIGH',
    escalationRequired: true,
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    allowedRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    approvalRequired: true,
    approvalMode: 'WORKFLOW_READY',
    maxDurationMinutes: 60,
    expiryRequired: true,
    requiresReason: true,
    requiresJustification: true,
    requiresSecondaryReviewer: false,
    allowedEntryPoints: ['FISCAL_GOVERNANCE'],
    automationAllowed: false,
  },
};

export function getOverridePolicy(code: OverrideCode): OverrideGovernancePolicyDefinition {
  return OVERRIDE_GOVERNANCE_REGISTRY[code];
}
