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

export type GovernanceDomainDefinition = {
  code: GovernanceDomainCode;
  displayName: string;
  description: string;
  ownerRoles: string[];
  governanceScope: GovernanceScope;
  auditSensitivity: GovernanceSensitivity;
  approvalSensitivity: GovernanceSensitivity;
};

export const GOVERNANCE_DOMAINS: GovernanceDomainDefinition[] = [
  {
    code: 'SYSTEM_GOVERNANCE',
    displayName: 'System Governance',
    description: 'Tenant system configuration, branding, and platform-wide settings.',
    ownerRoles: ['SUPER_ADMIN', 'SYSTEM_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'FINANCIAL_GOVERNANCE',
    displayName: 'Financial Governance',
    description: 'Posting controls, periods, chart of accounts, and financial risk controls.',
    ownerRoles: ['FINANCE_CONTROLLER', 'FINANCE_MANAGER', 'SUPER_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'CRITICAL',
    approvalSensitivity: 'CRITICAL',
  },
  {
    code: 'SECURITY_GOVERNANCE',
    displayName: 'Security Governance',
    description: 'Users, roles, permissions, delegations, and SoD policy administration.',
    ownerRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'CRITICAL',
    approvalSensitivity: 'CRITICAL',
  },
  {
    code: 'HR_GOVERNANCE',
    displayName: 'HR Governance',
    description: 'HR controls, payroll governance, and sensitive workforce data governance.',
    ownerRoles: ['HR_ADMIN', 'SUPER_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'CRM_GOVERNANCE',
    displayName: 'CRM Governance',
    description: 'Customer contact governance, privacy controls, and sales process administration.',
    ownerRoles: ['CRM_ADMIN', 'SUPER_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'MEDIUM',
    approvalSensitivity: 'MEDIUM',
  },
  {
    code: 'PROCUREMENT_GOVERNANCE',
    displayName: 'Procurement Governance',
    description: 'Supplier onboarding controls, procurement policies, and approvals governance.',
    ownerRoles: ['PROCUREMENT_MANAGER', 'SUPER_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
  {
    code: 'INVENTORY_GOVERNANCE',
    displayName: 'Inventory Governance',
    description: 'Inventory controls, stock adjustments, and warehouse governance.',
    ownerRoles: ['INVENTORY_MANAGER', 'SUPER_ADMIN'],
    governanceScope: 'TENANT',
    auditSensitivity: 'HIGH',
    approvalSensitivity: 'HIGH',
  },
];

export function getGovernanceDomainDefinition(code: GovernanceDomainCode) {
  return GOVERNANCE_DOMAINS.find((d) => d.code === code) ?? null;
}
