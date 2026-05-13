import type { JournalType } from '@prisma/client';

import type { GovernanceSensitivity } from './governance-domain-registry';
import type { GovernanceSeverity } from './governance-severity';
import type { GovernanceActionType } from './governance-action-registry';

export type IntercompanyGovernanceEnforcementMode = 'BLOCK' | 'ESCALATE';

export type IntercompanyAccountRole =
  | 'DUE_TO'
  | 'DUE_FROM'
  | 'INTERCOMPANY_CLEARING';

export type IntercompanyBalancingRequirement =
  | 'ENTITY_LEVEL_BALANCE_REQUIRED'
  | 'DUE_TO_DUE_FROM_MIRROR_REQUIRED';

export type IntercompanyGovernanceRuleCode =
  | 'ENTITY_PAIR_REQUIRED'
  | 'ENTITY_LEVEL_BALANCE'
  | 'DUE_TO_DUE_FROM_REQUIRED'
  | 'ELIMINATION_REFERENCE_REQUIRED'
  | 'LEGAL_ENTITY_SCOPE_REQUIRED';

export interface IntercompanyGovernanceRuleDefinition {
  ruleCode: IntercompanyGovernanceRuleCode;
  displayName: string;
  description: string;

  governanceSensitivity: GovernanceSensitivity;
  severity: GovernanceSeverity;

  applicableJournalTypes: JournalType[] | 'ANY';
  applicableGovernanceActions: GovernanceActionType[] | 'ANY';

  balancingRequirements: IntercompanyBalancingRequirement[];

  evidenceRequirements:
    | {
        required: boolean;
        evidenceCategory?: string;
        minCount?: number;
      }
    | null;

  approvalRequirements:
    | {
        requiresApproval: boolean;
        minimumSensitivity?: GovernanceSeverity;
      }
    | null;

  escalationAllowed: boolean;
  enforcementMode: IntercompanyGovernanceEnforcementMode;
}

export const INTERCOMPANY_GOVERNANCE_REGISTRY: Record<
  IntercompanyGovernanceRuleCode,
  IntercompanyGovernanceRuleDefinition
> = {
  LEGAL_ENTITY_SCOPE_REQUIRED: {
    ruleCode: 'LEGAL_ENTITY_SCOPE_REQUIRED',
    displayName: 'Legal entity scope assignment required',
    description:
      'Actors must have explicit, auditable access assignments for every legal entity involved in the journal, enforced via UserLegalEntityAccess.',
    governanceSensitivity: 'CRITICAL',
    severity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: 'ANY',
    balancingRequirements: [],
    evidenceRequirements: null,
    approvalRequirements: null,
    escalationAllowed: true,
    enforcementMode: 'BLOCK',
  },

  ENTITY_PAIR_REQUIRED: {
    ruleCode: 'ENTITY_PAIR_REQUIRED',
    displayName: 'Intercompany entity pairing required',
    description:
      'Intercompany journals must include at least two distinct legal entities and every line must be tagged with legalEntityId.',
    governanceSensitivity: 'CRITICAL',
    severity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['INTERCOMPANY_BALANCE_VIOLATION'],
    balancingRequirements: [],
    evidenceRequirements: null,
    approvalRequirements: null,
    escalationAllowed: true,
    enforcementMode: 'BLOCK',
  },

  ENTITY_LEVEL_BALANCE: {
    ruleCode: 'ENTITY_LEVEL_BALANCE',
    displayName: 'Intercompany entity-level balancing required',
    description:
      'Intercompany journals must balance at the legal-entity level to prevent orphan balances and unilateral postings.',
    governanceSensitivity: 'CRITICAL',
    severity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['INTERCOMPANY_BALANCE_VIOLATION'],
    balancingRequirements: ['ENTITY_LEVEL_BALANCE_REQUIRED'],
    evidenceRequirements: null,
    approvalRequirements: null,
    escalationAllowed: true,
    enforcementMode: 'BLOCK',
  },

  DUE_TO_DUE_FROM_REQUIRED: {
    ruleCode: 'DUE_TO_DUE_FROM_REQUIRED',
    displayName: 'Due-to / due-from mirrored balancing required',
    description:
      'Intercompany journals must include due-to and due-from accounts (identified through COA governance metadata) and enforce mirrored balancing between them.',
    governanceSensitivity: 'CRITICAL',
    severity: 'CRITICAL',
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['INTERCOMPANY_BALANCE_VIOLATION'],
    balancingRequirements: ['DUE_TO_DUE_FROM_MIRROR_REQUIRED'],
    evidenceRequirements: null,
    approvalRequirements: null,
    escalationAllowed: true,
    enforcementMode: 'BLOCK',
  },

  ELIMINATION_REFERENCE_REQUIRED: {
    ruleCode: 'ELIMINATION_REFERENCE_REQUIRED',
    displayName: 'Elimination-ready reference required',
    description:
      'Intercompany journals must include elimination-ready reference metadata to support future consolidations and elimination workflows.',
    governanceSensitivity: 'HIGH',
    severity: 'HIGH',
    applicableJournalTypes: 'ANY',
    applicableGovernanceActions: ['INTERCOMPANY_BALANCE_VIOLATION'],
    balancingRequirements: [],
    evidenceRequirements: null,
    approvalRequirements: null,
    escalationAllowed: true,
    enforcementMode: 'BLOCK',
  },
};

export function getIntercompanyGovernanceRule(
  code: IntercompanyGovernanceRuleCode,
): IntercompanyGovernanceRuleDefinition {
  return INTERCOMPANY_GOVERNANCE_REGISTRY[code];
}
