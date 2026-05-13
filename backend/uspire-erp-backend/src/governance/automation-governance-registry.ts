import type { GovernanceDomainCode } from './governance-domain-registry';
import type { GovernanceSeverity } from './governance-severity';
import type { AutomationSeverity } from './automation-severity';

export type AutomationMode = 'SUPERVISED' | 'RECOMMENDATION_ONLY' | 'EXECUTE_WITH_REVIEW';

export type AutomationCode =
  | 'RECURRING_JOURNAL_AUTOMATION'
  | 'REVERSAL_AUTOMATION'
  | 'INTERCOMPANY_AUTOMATION'
  | 'PERIOD_END_AUTOMATION'
  | 'ACCRUAL_AUTOMATION'
  | 'ALLOCATION_AUTOMATION';

export type AutomationPolicyDefinition = {
  automationCode: AutomationCode;
  displayName: string;
  governanceDomain: GovernanceDomainCode;
  severity: AutomationSeverity;
  auditSensitivity: GovernanceSeverity;

  allowedJournalTypes: string[] | 'ANY';

  evidenceRequired: boolean;
  minimumEvidenceCount: number;

  approvalRequired: boolean;
  requiresHumanReview: boolean;

  escalationAllowed: boolean;
  overrideAllowed: boolean;

  automationMode: AutomationMode;

  maxExecutionFrequencyMinutes: number;

  allowedExecutionWindows?: Array<{ startHourUtc: number; endHourUtc: number }>;

  fiscalConstraints?: {
    allowPostingIntoSoftClosedPeriod?: boolean;
    allowRetroPosting?: boolean;
  };

  entityConstraints?: {
    requiresLegalEntityScope?: boolean;
  };

  intercompanyConstraints?: {
    allowIntercompany?: boolean;
  };

  retryPolicy: {
    maxRetries: number;
    backoffMinutes: number;
  };

  suspensionRules: {
    suspendAfterConsecutiveFailures: number;
  };
};

export const AUTOMATION_GOVERNANCE_REGISTRY: Record<
  AutomationCode,
  AutomationPolicyDefinition
> = {
  RECURRING_JOURNAL_AUTOMATION: {
    automationCode: 'RECURRING_JOURNAL_AUTOMATION',
    displayName: 'Recurring Journal Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MODERATE',
    auditSensitivity: 'HIGH',
    allowedJournalTypes: ['STANDARD'],
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    approvalRequired: false,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: true,
    automationMode: 'EXECUTE_WITH_REVIEW',
    maxExecutionFrequencyMinutes: 60,
    fiscalConstraints: {
      allowPostingIntoSoftClosedPeriod: false,
      allowRetroPosting: false,
    },
    entityConstraints: {
      requiresLegalEntityScope: true,
    },
    intercompanyConstraints: {
      allowIntercompany: true,
    },
    retryPolicy: {
      maxRetries: 2,
      backoffMinutes: 30,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 3,
    },
  },

  REVERSAL_AUTOMATION: {
    automationCode: 'REVERSAL_AUTOMATION',
    displayName: 'Scheduled Reversal Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MODERATE',
    auditSensitivity: 'HIGH',
    allowedJournalTypes: ['REVERSING'],
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    approvalRequired: false,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: true,
    automationMode: 'EXECUTE_WITH_REVIEW',
    maxExecutionFrequencyMinutes: 60,
    fiscalConstraints: {
      allowPostingIntoSoftClosedPeriod: false,
      allowRetroPosting: false,
    },
    entityConstraints: {
      requiresLegalEntityScope: true,
    },
    intercompanyConstraints: {
      allowIntercompany: true,
    },
    retryPolicy: {
      maxRetries: 1,
      backoffMinutes: 60,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 2,
    },
  },

  INTERCOMPANY_AUTOMATION: {
    automationCode: 'INTERCOMPANY_AUTOMATION',
    displayName: 'Intercompany Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'CRITICAL',
    allowedJournalTypes: 'ANY',
    evidenceRequired: true,
    minimumEvidenceCount: 2,
    approvalRequired: true,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: true,
    automationMode: 'SUPERVISED',
    maxExecutionFrequencyMinutes: 60,
    retryPolicy: {
      maxRetries: 0,
      backoffMinutes: 0,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 1,
    },
  },

  PERIOD_END_AUTOMATION: {
    automationCode: 'PERIOD_END_AUTOMATION',
    displayName: 'Period End Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    auditSensitivity: 'CRITICAL',
    allowedJournalTypes: 'ANY',
    evidenceRequired: true,
    minimumEvidenceCount: 2,
    approvalRequired: true,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: false,
    automationMode: 'SUPERVISED',
    maxExecutionFrequencyMinutes: 60 * 24,
    retryPolicy: {
      maxRetries: 0,
      backoffMinutes: 0,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 1,
    },
  },

  ACCRUAL_AUTOMATION: {
    automationCode: 'ACCRUAL_AUTOMATION',
    displayName: 'Accrual Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MODERATE',
    auditSensitivity: 'HIGH',
    allowedJournalTypes: ['ACCRUAL'],
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    approvalRequired: false,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: true,
    automationMode: 'EXECUTE_WITH_REVIEW',
    maxExecutionFrequencyMinutes: 60 * 24,
    retryPolicy: {
      maxRetries: 1,
      backoffMinutes: 60,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 2,
    },
  },

  ALLOCATION_AUTOMATION: {
    automationCode: 'ALLOCATION_AUTOMATION',
    displayName: 'Allocation Automation',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MODERATE',
    auditSensitivity: 'HIGH',
    allowedJournalTypes: 'ANY',
    evidenceRequired: true,
    minimumEvidenceCount: 1,
    approvalRequired: true,
    requiresHumanReview: true,
    escalationAllowed: true,
    overrideAllowed: true,
    automationMode: 'SUPERVISED',
    maxExecutionFrequencyMinutes: 60 * 24,
    retryPolicy: {
      maxRetries: 0,
      backoffMinutes: 0,
    },
    suspensionRules: {
      suspendAfterConsecutiveFailures: 1,
    },
  },
};

export function getAutomationPolicy(code: AutomationCode): AutomationPolicyDefinition {
  return AUTOMATION_GOVERNANCE_REGISTRY[code];
}
