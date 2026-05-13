import type { JournalType } from '@prisma/client';
import type { GovernanceSeverity } from '../governance/governance-severity';

export type JournalPolicyTypeCode =
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

export type JournalDimensionCode =
  | 'LEGAL_ENTITY'
  | 'DEPARTMENT'
  | 'PROJECT'
  | 'FUND';

export interface JournalTypePolicyDefinition {
  code: JournalPolicyTypeCode;
  displayName: string;
  description: string;

  governanceSensitivity: GovernanceSeverity;

  sourceModule:
    | 'GL'
    | 'AP'
    | 'AR'
    | 'PAYMENTS'
    | 'BANK_RECON'
    | 'SYSTEM'
    | 'OTHER';

  automationAllowed: boolean;

  requiredDimensions: JournalDimensionCode[];

  requiredEvidence:
    | {
        required: boolean;
        minCount?: number;
      }
    | null;

  reversalRules:
    | {
        canBeReversed: boolean;
        reversalJournalType: JournalType;
        requiresOriginalReference: boolean;
      }
    | null;

  postingRules:
    | {
        allowsInOpeningPeriod: boolean;
      }
    | null;

  approvalRequirements:
    | {
        requiresApproval: boolean;
        minimumSensitivity?: GovernanceSeverity;
      }
    | null;

  allowedAccountCategories?: string[];
  restrictedAccountCategories?: string[];
}

export const JOURNAL_TYPE_REGISTRY: Record<JournalPolicyTypeCode, JournalTypePolicyDefinition> = {
  GENERAL_JOURNAL: {
    code: 'GENERAL_JOURNAL',
    displayName: 'General Journal',
    description: 'Standard operational journal entry.',
    governanceSensitivity: 'MEDIUM',
    sourceModule: 'GL',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: false,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: false },
  },

  PAYMENT_JOURNAL: {
    code: 'PAYMENT_JOURNAL',
    displayName: 'Payment Journal',
    description: 'Journal originating from payments processing.',
    governanceSensitivity: 'HIGH',
    sourceModule: 'PAYMENTS',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: true,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: false },
  },

  RECEIPT_JOURNAL: {
    code: 'RECEIPT_JOURNAL',
    displayName: 'Receipt Journal',
    description: 'Journal originating from receipt posting.',
    governanceSensitivity: 'HIGH',
    sourceModule: 'AR',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: true,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: false },
  },

  ACCRUAL_JOURNAL: {
    code: 'ACCRUAL_JOURNAL',
    displayName: 'Accrual Journal',
    description: 'Accrual journal entry.',
    governanceSensitivity: 'HIGH',
    sourceModule: 'GL',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: false,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: false },
  },

  REVERSAL_JOURNAL: {
    code: 'REVERSAL_JOURNAL',
    displayName: 'Reversal Journal',
    description: 'System-generated reversal journal that reverses a posted journal.',
    governanceSensitivity: 'CRITICAL',
    sourceModule: 'GL',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: null,
    postingRules: { allowsInOpeningPeriod: true },
    approvalRequirements: { requiresApproval: false },
  },

  OPENING_BALANCE_JOURNAL: {
    code: 'OPENING_BALANCE_JOURNAL',
    displayName: 'Opening Balance Journal',
    description: 'Opening balances journal used during onboarding/cutover.',
    governanceSensitivity: 'CRITICAL',
    sourceModule: 'GL',
    automationAllowed: false,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: false,
    },
    postingRules: { allowsInOpeningPeriod: true },
    approvalRequirements: { requiresApproval: true, minimumSensitivity: 'CRITICAL' },
  },

  ADJUSTMENT_JOURNAL: {
    code: 'ADJUSTMENT_JOURNAL',
    displayName: 'Adjustment Journal',
    description: 'Adjustment journal with enhanced auditability and approval sensitivity.',
    governanceSensitivity: 'HIGH',
    sourceModule: 'GL',
    automationAllowed: false,
    requiredDimensions: [],
    requiredEvidence: { required: false, minCount: 1 },
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: false,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: true, minimumSensitivity: 'HIGH' },
  },

  PAYROLL_JOURNAL: {
    code: 'PAYROLL_JOURNAL',
    displayName: 'Payroll Journal',
    description: 'Payroll generated journal entry (future).',
    governanceSensitivity: 'CRITICAL',
    sourceModule: 'OTHER',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: true,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: true, minimumSensitivity: 'CRITICAL' },
  },

  INTERCOMPANY_JOURNAL: {
    code: 'INTERCOMPANY_JOURNAL',
    displayName: 'Intercompany Journal',
    description: 'Paired inter-entity balancing journal entry (future).',
    governanceSensitivity: 'HIGH',
    sourceModule: 'GL',
    automationAllowed: false,
    requiredDimensions: ['LEGAL_ENTITY'],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: false,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: true, minimumSensitivity: 'HIGH' },
  },

  SYSTEM_GENERATED_JOURNAL: {
    code: 'SYSTEM_GENERATED_JOURNAL',
    displayName: 'System Generated Journal',
    description: 'Journal generated by automation/integrations; restricted editability and traceable source.',
    governanceSensitivity: 'HIGH',
    sourceModule: 'SYSTEM',
    automationAllowed: true,
    requiredDimensions: [],
    requiredEvidence: null,
    reversalRules: {
      canBeReversed: true,
      reversalJournalType: 'REVERSING',
      requiresOriginalReference: true,
    },
    postingRules: { allowsInOpeningPeriod: false },
    approvalRequirements: { requiresApproval: false },
  },
};

export function getJournalTypePolicy(code: JournalPolicyTypeCode): JournalTypePolicyDefinition {
  return JOURNAL_TYPE_REGISTRY[code];
}
