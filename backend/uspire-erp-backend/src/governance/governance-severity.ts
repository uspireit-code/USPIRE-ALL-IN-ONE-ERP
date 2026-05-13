export type GovernanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const GOVERNANCE_SEVERITY_ORDER: Record<GovernanceSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
