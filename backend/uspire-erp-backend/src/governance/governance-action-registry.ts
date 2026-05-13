import type { GovernanceDomainCode } from './governance-domain-registry';
import type { GovernanceSeverity } from './governance-severity';

export type GovernanceActionType =
  | 'SETTINGS_SYSTEM_GOVERNANCE_UPDATE'
  | 'SETTINGS_FINANCIAL_GOVERNANCE_UPDATE'
  | 'JOURNAL_NUMBERING_CONFIGURATION_CHANGED'
  | 'EVIDENCE_REQUIRED'
  | 'EVIDENCE_VALIDATED'
  | 'MISSING_SUPPORT_DOCUMENT'
  | 'INVALID_ATTACHMENT_TYPE'
  | 'GOVERNANCE_JUSTIFICATION_REQUIRED'
  | 'OVERRIDE_REQUESTED'
  | 'OVERRIDE_APPROVED'
  | 'OVERRIDE_REJECTED'
  | 'OVERRIDE_EXPIRED'
  | 'OVERRIDE_EXECUTED'
  | 'OVERRIDE_REVOKED'
  | 'OVERRIDE_SESSION_CREATED'
  | 'OVERRIDE_SESSION_UPDATED'
  | 'OVERRIDE_SESSION_DELETED'
  | 'OVERRIDE_SESSION_APPROVED'
  | 'OVERRIDE_SESSION_REJECTED'
  | 'PERIOD_CLOSE'
  | 'PERIOD_REOPEN'
  | 'PERIOD_CREATE'
  | 'PERIOD_CORRECT'
  | 'PERIOD_SOFT_CLOSE_POST_OVERRIDE'
  | 'RETRO_POSTING_OVERRIDE'
  | 'ROLE_ASSIGNMENT'
  | 'ROLE_PERMISSION_CHANGE'
  | 'DELEGATION_CHANGE'
  | 'USER_UNLOCK'
  | 'COA_LOCK'
  | 'COA_UNLOCK'
  | 'ESCALATION_OVERRIDE'
  | 'SOD_BLOCKED'
  | 'LIFECYCLE_GUARD_BLOCKED'
  | 'IMMUTABILITY_GUARD_BLOCKED'
  | 'GL_JOURNAL_OVERRIDE_POST'
  | 'GL_JOURNAL_VOID'
  | 'INVALID_ACCOUNT_COMBINATION'
  | 'PROHIBITED_DIMENSION_PAIRING'
  | 'INTERCOMPANY_BALANCE_VIOLATION'
  | 'INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION'
  | 'INTERCOMPANY_ELIMINATION_REFERENCE_VIOLATION'
  | 'RESTRICTED_CONTROL_ACCOUNT_USAGE'
  | 'MISSING_REQUIRED_DIMENSION_COMBINATION'
  | 'COMBINATION_OVERRIDE_REQUESTED'
  | 'JOURNAL_TYPE_POLICY_BLOCKED'
  | 'JOURNAL_TYPE_MISSING_REQUIRED_DIMENSION'
  | 'JOURNAL_TYPE_EVIDENCE_REQUIRED'
  | 'JOURNAL_TYPE_INVALID_SOURCE'
  | 'JOURNAL_TYPE_REVERSAL_POLICY_VIOLATION'
  | 'JOURNAL_TYPE_OPENING_BALANCE_POLICY_VIOLATION';

export interface GovernanceActionDefinition {
  type: GovernanceActionType;
  governanceDomain: GovernanceDomainCode;
  severity: GovernanceSeverity;
  requiresApproval: boolean;
  requiresEscalation: boolean;
  requiresReason: boolean;
  auditSensitivity: GovernanceSeverity;
}

export const GOVERNANCE_ACTION_REGISTRY: Record<GovernanceActionType, GovernanceActionDefinition> = {
  SETTINGS_SYSTEM_GOVERNANCE_UPDATE: {
    type: 'SETTINGS_SYSTEM_GOVERNANCE_UPDATE',
    governanceDomain: 'SYSTEM_GOVERNANCE',
    severity: 'MEDIUM',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'MEDIUM',
  },
  EVIDENCE_REQUIRED: {
    type: 'EVIDENCE_REQUIRED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  EVIDENCE_VALIDATED: {
    type: 'EVIDENCE_VALIDATED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'MEDIUM',
  },
  MISSING_SUPPORT_DOCUMENT: {
    type: 'MISSING_SUPPORT_DOCUMENT',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  INVALID_ATTACHMENT_TYPE: {
    type: 'INVALID_ATTACHMENT_TYPE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  GOVERNANCE_JUSTIFICATION_REQUIRED: {
    type: 'GOVERNANCE_JUSTIFICATION_REQUIRED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'MEDIUM',
  },
  OVERRIDE_REQUESTED: {
    type: 'OVERRIDE_REQUESTED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_APPROVED: {
    type: 'OVERRIDE_APPROVED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_REJECTED: {
    type: 'OVERRIDE_REJECTED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_EXPIRED: {
    type: 'OVERRIDE_EXPIRED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  OVERRIDE_EXECUTED: {
    type: 'OVERRIDE_EXECUTED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_REVOKED: {
    type: 'OVERRIDE_REVOKED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_SESSION_CREATED: {
    type: 'OVERRIDE_SESSION_CREATED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_SESSION_UPDATED: {
    type: 'OVERRIDE_SESSION_UPDATED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_SESSION_DELETED: {
    type: 'OVERRIDE_SESSION_DELETED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_SESSION_APPROVED: {
    type: 'OVERRIDE_SESSION_APPROVED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  OVERRIDE_SESSION_REJECTED: {
    type: 'OVERRIDE_SESSION_REJECTED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  SETTINGS_FINANCIAL_GOVERNANCE_UPDATE: {
    type: 'SETTINGS_FINANCIAL_GOVERNANCE_UPDATE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'HIGH',
  },
  JOURNAL_NUMBERING_CONFIGURATION_CHANGED: {
    type: 'JOURNAL_NUMBERING_CONFIGURATION_CHANGED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'HIGH',
  },
  PERIOD_CLOSE: {
    type: 'PERIOD_CLOSE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  PERIOD_REOPEN: {
    type: 'PERIOD_REOPEN',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  PERIOD_CREATE: {
    type: 'PERIOD_CREATE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'MEDIUM',
  },
  PERIOD_CORRECT: {
    type: 'PERIOD_CORRECT',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'HIGH',
  },
  PERIOD_SOFT_CLOSE_POST_OVERRIDE: {
    type: 'PERIOD_SOFT_CLOSE_POST_OVERRIDE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  RETRO_POSTING_OVERRIDE: {
    type: 'RETRO_POSTING_OVERRIDE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  ROLE_ASSIGNMENT: {
    type: 'ROLE_ASSIGNMENT',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  ROLE_PERMISSION_CHANGE: {
    type: 'ROLE_PERMISSION_CHANGE',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  DELEGATION_CHANGE: {
    type: 'DELEGATION_CHANGE',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  USER_UNLOCK: {
    type: 'USER_UNLOCK',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'HIGH',
  },
  COA_UNLOCK: {
    type: 'COA_UNLOCK',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: true,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  COA_LOCK: {
    type: 'COA_LOCK',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  ESCALATION_OVERRIDE: {
    type: 'ESCALATION_OVERRIDE',
    governanceDomain: 'SYSTEM_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  SOD_BLOCKED: {
    type: 'SOD_BLOCKED',
    governanceDomain: 'SECURITY_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'CRITICAL',
  },
  LIFECYCLE_GUARD_BLOCKED: {
    type: 'LIFECYCLE_GUARD_BLOCKED',
    governanceDomain: 'SYSTEM_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  IMMUTABILITY_GUARD_BLOCKED: {
    type: 'IMMUTABILITY_GUARD_BLOCKED',
    governanceDomain: 'SYSTEM_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'CRITICAL',
  },
  GL_JOURNAL_OVERRIDE_POST: {
    type: 'GL_JOURNAL_OVERRIDE_POST',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  GL_JOURNAL_VOID: {
    type: 'GL_JOURNAL_VOID',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: true,
    auditSensitivity: 'HIGH',
  },
  INVALID_ACCOUNT_COMBINATION: {
    type: 'INVALID_ACCOUNT_COMBINATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  PROHIBITED_DIMENSION_PAIRING: {
    type: 'PROHIBITED_DIMENSION_PAIRING',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  INTERCOMPANY_BALANCE_VIOLATION: {
    type: 'INTERCOMPANY_BALANCE_VIOLATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION: {
    type: 'INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  INTERCOMPANY_ELIMINATION_REFERENCE_VIOLATION: {
    type: 'INTERCOMPANY_ELIMINATION_REFERENCE_VIOLATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  RESTRICTED_CONTROL_ACCOUNT_USAGE: {
    type: 'RESTRICTED_CONTROL_ACCOUNT_USAGE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'CRITICAL',
  },
  MISSING_REQUIRED_DIMENSION_COMBINATION: {
    type: 'MISSING_REQUIRED_DIMENSION_COMBINATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  COMBINATION_OVERRIDE_REQUESTED: {
    type: 'COMBINATION_OVERRIDE_REQUESTED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: true,
    requiresReason: true,
    auditSensitivity: 'CRITICAL',
  },
  JOURNAL_TYPE_POLICY_BLOCKED: {
    type: 'JOURNAL_TYPE_POLICY_BLOCKED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  JOURNAL_TYPE_MISSING_REQUIRED_DIMENSION: {
    type: 'JOURNAL_TYPE_MISSING_REQUIRED_DIMENSION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  JOURNAL_TYPE_EVIDENCE_REQUIRED: {
    type: 'JOURNAL_TYPE_EVIDENCE_REQUIRED',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  JOURNAL_TYPE_INVALID_SOURCE: {
    type: 'JOURNAL_TYPE_INVALID_SOURCE',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'HIGH',
  },
  JOURNAL_TYPE_REVERSAL_POLICY_VIOLATION: {
    type: 'JOURNAL_TYPE_REVERSAL_POLICY_VIOLATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'CRITICAL',
  },
  JOURNAL_TYPE_OPENING_BALANCE_POLICY_VIOLATION: {
    type: 'JOURNAL_TYPE_OPENING_BALANCE_POLICY_VIOLATION',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'CRITICAL',
    requiresApproval: false,
    requiresEscalation: false,
    requiresReason: false,
    auditSensitivity: 'CRITICAL',
  },
};

export function getGovernanceActionDefinition(type: GovernanceActionType): GovernanceActionDefinition {
  return GOVERNANCE_ACTION_REGISTRY[type];
}
