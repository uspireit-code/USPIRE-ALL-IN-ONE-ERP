export type GovernanceDomainCode =
  | 'SYSTEM_GOVERNANCE'
  | 'FINANCIAL_GOVERNANCE'
  | 'SECURITY_GOVERNANCE'
  | 'HR_GOVERNANCE'
  | 'CRM_GOVERNANCE'
  | 'PROCUREMENT_GOVERNANCE'
  | 'INVENTORY_GOVERNANCE';

export type GovernanceScope = 'TENANT' | 'GLOBAL';

export type GovernanceSensitivity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface GovernanceDomainDefinition {
  code: GovernanceDomainCode;
  displayName: string;
  description: string;
  ownerRoles: string[];
  governanceScope: GovernanceScope;
  auditSensitivity: GovernanceSensitivity;
  approvalSensitivity: GovernanceSensitivity;
}

export const GOVERNANCE_DOMAINS: GovernanceDomainDefinition[] = [
  {
    code: 'SYSTEM_GOVERNANCE',
    displayName: 'System Governance',
    description: 'Tenant identity, branding, UX defaults, and non-financial tenant configuration.',
    ownerRoles: ['SUPER_ADMIN', 'SYSTEM_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'MEDIUM',
    approvalSensitivity: 'LOW',
  },
  {
    code: 'FINANCIAL_GOVERNANCE',
    displayName: 'Financial Governance',
    description: 'Posting controls, control accounts, COA structure, tax configuration, and period governance.',
    ownerRoles: ['SUPER_ADMIN', 'CFO', 'FINANCIAL_CONTROLLER'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'SECURITY_GOVERNANCE',
    displayName: 'Security Governance',
    description: 'Users, roles, permissions, delegations, and SoD policy administration.',
    ownerRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'CRITICAL',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'HR_GOVERNANCE',
    displayName: 'HR Governance',
    description: 'HR master data and HR module configuration.',
    ownerRoles: ['SUPER_ADMIN', 'HR_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'MEDIUM',
  },
  {
    code: 'CRM_GOVERNANCE',
    displayName: 'CRM Governance',
    description: 'CRM configuration, pipeline governance, and customer engagement controls.',
    ownerRoles: ['SUPER_ADMIN', 'CRM_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'MEDIUM',
    approvalSensitivity: 'LOW',
  },
  {
    code: 'PROCUREMENT_GOVERNANCE',
    displayName: 'Procurement Governance',
    description: 'Procurement configuration, approvals, and vendor governance controls.',
    ownerRoles: ['SUPER_ADMIN', 'PROCUREMENT_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'INVENTORY_GOVERNANCE',
    displayName: 'Inventory Governance',
    description: 'Inventory configuration, stock governance rules, and valuation controls.',
    ownerRoles: ['SUPER_ADMIN', 'INVENTORY_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'MEDIUM',
  },
];

export function getGovernanceDomain(code: GovernanceDomainCode): GovernanceDomainDefinition {
  const d = GOVERNANCE_DOMAINS.find((x) => x.code === code);
  if (!d) {
    throw new Error(`Unknown governance domain: ${code}`);
  }
  return d;
}
