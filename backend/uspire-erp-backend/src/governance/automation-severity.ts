export type AutomationSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const AUTOMATION_SEVERITY_ORDER: Record<AutomationSeverity, number> = {
  LOW: 10,
  MODERATE: 20,
  HIGH: 30,
  CRITICAL: 40,
};
