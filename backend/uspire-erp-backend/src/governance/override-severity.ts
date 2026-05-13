export type OverrideSeverity =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL'
  | 'EMERGENCY';

export const OVERRIDE_SEVERITY_ORDER: Record<OverrideSeverity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
  EMERGENCY: 5,
};
