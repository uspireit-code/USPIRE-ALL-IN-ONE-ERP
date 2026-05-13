import type { JournalType } from '@prisma/client';

import type { GovernanceSeverity } from '../governance/governance-severity';

export type CombinationGovernanceEnforcementMode = 'BLOCK' | 'ESCALATE';

export type CombinationGovernanceModuleCode =
  | 'GL'
  | 'AP'
  | 'AR'
  | 'PAYMENTS'
  | 'BANK_RECON'
  | 'SYSTEM'
  | 'OTHER';

export type CombinationGovernanceRuleCode =
  | 'RESTRICT_CONTROL_ACCOUNT_MANUAL_USE'
  | 'CASH_EQUIVALENT_RESTRICTIONS'
  | 'FUND_REQUIRES_PROJECT'
  | 'ACCOUNT_REQUIRES_DIMENSIONS'
  | 'INTERCOMPANY_ENTITY_PAIRING_REQUIRED';

export type CombinationGovernanceDimensionCode =
  | 'LEGAL_ENTITY'
  | 'DEPARTMENT'
  | 'PROJECT'
  | 'FUND';

export type CombinationGovernanceJournalPolicyTypeCode =
  | 'GENERAL_JOURNAL'
  | 'PAYMENT_JOURNAL'
  | 'RECEIPT_JOURNAL'
  | 'ACCRUAL_JOURNAL'
  | 'REVERSAL_JOURNAL'
  | 'OPENING_BALANCE_JOURNAL'
  | 'ADJUSTMENT_JOURNAL'
  | 'PAYROLL_JOURNAL'
  | 'INTERCOMPANY_JOURNAL'
  | 'SYSTEM_GENERATED_JOURNAL';

export type CombinationWildcard = '*';

export type CombinationSelector = {
  accountId?: string;
  accountCode?: string;
  accountType?: string;
  isControlAccount?: boolean;
  isCashEquivalent?: boolean;

  legalEntityId?: string | null | CombinationWildcard;
  departmentId?: string | null | CombinationWildcard;
  projectId?: string | null | CombinationWildcard;
  fundId?: string | null | CombinationWildcard;

  side?: 'DEBIT' | 'CREDIT' | 'ANY';
};

export interface CombinationGovernanceRuleDefinition {
  ruleCode: CombinationGovernanceRuleCode;
  displayName: string;
  description: string;

  governanceSensitivity: GovernanceSeverity;

  applicableJournalTypes: JournalType[] | 'ANY';
  applicableJournalPolicyTypes: CombinationGovernanceJournalPolicyTypeCode[] | 'ANY';
  applicableModules: CombinationGovernanceModuleCode[] | 'ANY';

  allowedCombinations: CombinationSelector[];
  prohibitedCombinations: CombinationSelector[];

  requiredDimensions: CombinationGovernanceDimensionCode[];
  restrictedDimensions: CombinationGovernanceDimensionCode[];

  enforcementMode: CombinationGovernanceEnforcementMode;
  severity: GovernanceSeverity;
  escalationAllowed: boolean;
}

export const COMBINATION_GOVERNANCE_REGISTRY: Record<
  CombinationGovernanceRuleCode,
  CombinationGovernanceRuleDefinition
> = {
  RESTRICT_CONTROL_ACCOUNT_MANUAL_USE: {
    ruleCode: 'RESTRICT_CONTROL_ACCOUNT_MANUAL_USE',
    displayName: 'Restrict control account manual use',
    description:
      'Control accounts are restricted from manual and upload-originated journals unless explicitly allowed by policy.',
    governanceSensitivity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableJournalPolicyTypes: 'ANY',
    applicableModules: ['GL'],
    allowedCombinations: [],
    prohibitedCombinations: [{ isControlAccount: true }],
    requiredDimensions: [],
    restrictedDimensions: [],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    escalationAllowed: false,
  },

  CASH_EQUIVALENT_RESTRICTIONS: {
    ruleCode: 'CASH_EQUIVALENT_RESTRICTIONS',
    displayName: 'Cash-equivalent restrictions',
    description:
      'Cash-equivalent accounts are governance sensitive and may be restricted in certain operational contexts.',
    governanceSensitivity: 'HIGH',
    applicableJournalTypes: 'ANY',
    applicableJournalPolicyTypes: 'ANY',
    applicableModules: 'ANY',
    allowedCombinations: [],
    prohibitedCombinations: [],
    requiredDimensions: [],
    restrictedDimensions: [],
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    escalationAllowed: true,
  },

  FUND_REQUIRES_PROJECT: {
    ruleCode: 'FUND_REQUIRES_PROJECT',
    displayName: 'Fund requires project',
    description:
      'Fund dimension cannot be selected without a project. This protects fund/project linkage integrity.',
    governanceSensitivity: 'MEDIUM',
    applicableJournalTypes: 'ANY',
    applicableJournalPolicyTypes: 'ANY',
    applicableModules: 'ANY',
    allowedCombinations: [],
    prohibitedCombinations: [{ fundId: '*', projectId: null }],
    requiredDimensions: [],
    restrictedDimensions: [],
    enforcementMode: 'BLOCK',
    severity: 'MEDIUM',
    escalationAllowed: false,
  },

  ACCOUNT_REQUIRES_DIMENSIONS: {
    ruleCode: 'ACCOUNT_REQUIRES_DIMENSIONS',
    displayName: 'Account requires dimensions',
    description:
      'Certain accounts require specific dimensions (e.g. department/project/fund) based on COA configuration.',
    governanceSensitivity: 'HIGH',
    applicableJournalTypes: 'ANY',
    applicableJournalPolicyTypes: 'ANY',
    applicableModules: 'ANY',
    allowedCombinations: [],
    prohibitedCombinations: [],
    requiredDimensions: [],
    restrictedDimensions: [],
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    escalationAllowed: true,
  },

  INTERCOMPANY_ENTITY_PAIRING_REQUIRED: {
    ruleCode: 'INTERCOMPANY_ENTITY_PAIRING_REQUIRED',
    displayName: 'Intercompany requires entity pairing',
    description:
      'Intercompany journals must include explicit legal entity tagging and valid multi-entity pairing. This rule establishes the governance hook; full due-to/due-from validation is implemented in later phases.',
    governanceSensitivity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableJournalPolicyTypes: ['INTERCOMPANY_JOURNAL'],
    applicableModules: 'ANY',
    allowedCombinations: [],
    prohibitedCombinations: [],
    requiredDimensions: ['LEGAL_ENTITY'],
    restrictedDimensions: [],
    enforcementMode: 'BLOCK',
    severity: 'CRITICAL',
    escalationAllowed: true,
  },
};

export function getCombinationGovernanceRule(
  code: CombinationGovernanceRuleCode,
): CombinationGovernanceRuleDefinition {
  return COMBINATION_GOVERNANCE_REGISTRY[code];
}
