import type { GovernanceDomainCode } from './governance-domain-registry';
import { PERMISSIONS } from '../rbac/permission-catalog';

export type GovernanceKpiSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type GovernanceKpiCalculationStrategy =
  | 'COUNT'
  | 'RATE'
  | 'DURATION_AVG'
  | 'LATENCY_AVG'
  | 'WEIGHTED_RATE';

export type GovernanceKpiAggregationStrategy =
  | 'TOTAL'
  | 'BY_GOVERNANCE_DOMAIN'
  | 'BY_SEVERITY'
  | 'BY_AUTOMATION_CODE'
  | 'BY_OVERRIDE_CODE'
  | 'BY_LEGAL_ENTITY'
  | 'BY_ACTOR_TYPE'
  | 'BY_LIFECYCLE_STATE'
  | 'BY_AGING_BAND';

export type GovernanceKpiDrillThroughTarget =
  | 'JOURNALS'
  | 'AUTOMATION_EXECUTION_SESSIONS'
  | 'AUTOMATION_SCHEDULES'
  | 'OVERRIDE_SESSIONS'
  | 'AUDIT_EVENTS'
  | 'AUDIT_EVIDENCE';

export interface GovernanceKpiAlertThresholds {
  warn?: number;
  critical?: number;
}

export interface GovernanceKpiVisibilityRules {
  requiredAnyPermissions: string[];
  allowDomains?: GovernanceDomainCode[] | 'ANY';
}

export interface GovernanceKpiRetentionScope {
  source: 'AUDIT_EVENT' | 'EXECUTION_SESSION' | 'SCHEDULE' | 'OVERRIDE_SESSION' | 'EVIDENCE';
  suggestedRetentionDays: number;
}

export interface GovernanceKpiDefinition {
  kpiCode: string;
  displayName: string;
  governanceDomain: GovernanceDomainCode | 'CROSS_DOMAIN';
  severity: GovernanceKpiSeverity;

  calculationStrategy: GovernanceKpiCalculationStrategy;
  aggregationStrategy: GovernanceKpiAggregationStrategy;

  drillThroughSupported: boolean;
  drillThroughTarget?: GovernanceKpiDrillThroughTarget;

  alertThresholds?: GovernanceKpiAlertThresholds;
  trendSupport: boolean;

  visibilityRules: GovernanceKpiVisibilityRules;
  retentionScope: GovernanceKpiRetentionScope;
}

export function getGovernanceKpiDefinition(kpiCode: string): GovernanceKpiDefinition | null {
  const code = String(kpiCode ?? '').trim();
  return GOVERNANCE_KPI_REGISTRY[code] ?? null;
}

export const GOVERNANCE_KPI_REGISTRY: Record<string, GovernanceKpiDefinition> = {
  OVERRIDE_FREQUENCY: {
    kpiCode: 'OVERRIDE_FREQUENCY',
    displayName: 'Override frequency',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'HIGH',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_OVERRIDE_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'OVERRIDE_SESSIONS',
    alertThresholds: { warn: 0.05, critical: 0.1 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'OVERRIDE_SESSION', suggestedRetentionDays: 365 },
  },

  OVERRIDE_APPROVAL_RATE: {
    kpiCode: 'OVERRIDE_APPROVAL_RATE',
    displayName: 'Override approval rate',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'MEDIUM',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_OVERRIDE_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'OVERRIDE_SESSIONS',
    alertThresholds: { warn: 0.9, critical: 0.8 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'OVERRIDE_SESSION', suggestedRetentionDays: 365 },
  },

  ESCALATION_RATE: {
    kpiCode: 'ESCALATION_RATE',
    displayName: 'Governance escalation rate',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'CRITICAL',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_SEVERITY',
    drillThroughSupported: true,
    drillThroughTarget: 'AUDIT_EVENTS',
    alertThresholds: { warn: 0.01, critical: 0.03 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'AUDIT_EVENT', suggestedRetentionDays: 365 },
  },

  AUTOMATION_FAILURE_RATE: {
    kpiCode: 'AUTOMATION_FAILURE_RATE',
    displayName: 'Automation failure rate',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_AUTOMATION_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'AUTOMATION_EXECUTION_SESSIONS',
    alertThresholds: { warn: 0.02, critical: 0.05 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'EXECUTION_SESSION', suggestedRetentionDays: 365 },
  },

  AUTOMATION_SUSPENSION_RATE: {
    kpiCode: 'AUTOMATION_SUSPENSION_RATE',
    displayName: 'Automation suspension rate',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_AUTOMATION_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'AUTOMATION_SCHEDULES',
    alertThresholds: { warn: 0.01, critical: 0.03 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'SCHEDULE', suggestedRetentionDays: 365 },
  },

  EXECUTION_SUCCESS_RATE: {
    kpiCode: 'EXECUTION_SUCCESS_RATE',
    displayName: 'Execution success rate',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_AUTOMATION_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'AUTOMATION_EXECUTION_SESSIONS',
    alertThresholds: { warn: 0.98, critical: 0.95 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'EXECUTION_SESSION', suggestedRetentionDays: 365 },
  },

  SCHEDULE_EXECUTION_LATENCY_AVG_SECONDS: {
    kpiCode: 'SCHEDULE_EXECUTION_LATENCY_AVG_SECONDS',
    displayName: 'Schedule execution latency (avg seconds)',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    calculationStrategy: 'LATENCY_AVG',
    aggregationStrategy: 'BY_AUTOMATION_CODE',
    drillThroughSupported: true,
    drillThroughTarget: 'AUTOMATION_EXECUTION_SESSIONS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'EXECUTION_SESSION', suggestedRetentionDays: 365 },
  },

  EVIDENCE_COMPLIANCE_RATE: {
    kpiCode: 'EVIDENCE_COMPLIANCE_RATE',
    displayName: 'Evidence compliance rate',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'HIGH',
    calculationStrategy: 'RATE',
    aggregationStrategy: 'BY_GOVERNANCE_DOMAIN',
    drillThroughSupported: true,
    drillThroughTarget: 'AUDIT_EVIDENCE',
    alertThresholds: { warn: 0.98, critical: 0.95 },
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'EVIDENCE', suggestedRetentionDays: 365 },
  },

  REVIEW_TURNAROUND_AVG_SECONDS: {
    kpiCode: 'REVIEW_TURNAROUND_AVG_SECONDS',
    displayName: 'Review turnaround time (avg seconds)',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    calculationStrategy: 'DURATION_AVG',
    aggregationStrategy: 'TOTAL',
    drillThroughSupported: true,
    drillThroughTarget: 'JOURNALS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'AUDIT_EVENT', suggestedRetentionDays: 365 },
  },

  DECISION_RESOLUTION_AVG_SECONDS: {
    kpiCode: 'DECISION_RESOLUTION_AVG_SECONDS',
    displayName: 'Decision resolution time (avg seconds)',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    calculationStrategy: 'DURATION_AVG',
    aggregationStrategy: 'TOTAL',
    drillThroughSupported: true,
    drillThroughTarget: 'JOURNALS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'AUDIT_EVENT', suggestedRetentionDays: 365 },
  },

  BACKLOG_PENDING_REVIEW_COUNT: {
    kpiCode: 'BACKLOG_PENDING_REVIEW_COUNT',
    displayName: 'Backlog: pending review (count)',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'MEDIUM',
    calculationStrategy: 'COUNT',
    aggregationStrategy: 'BY_AGING_BAND',
    drillThroughSupported: true,
    drillThroughTarget: 'JOURNALS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'AUDIT_EVENT', suggestedRetentionDays: 365 },
  },

  BACKLOG_PENDING_APPROVAL_COUNT: {
    kpiCode: 'BACKLOG_PENDING_APPROVAL_COUNT',
    displayName: 'Backlog: pending approval (count)',
    governanceDomain: 'FINANCIAL_GOVERNANCE',
    severity: 'HIGH',
    calculationStrategy: 'COUNT',
    aggregationStrategy: 'BY_AGING_BAND',
    drillThroughSupported: true,
    drillThroughTarget: 'JOURNALS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: ['FINANCIAL_GOVERNANCE'],
    },
    retentionScope: { source: 'AUDIT_EVENT', suggestedRetentionDays: 365 },
  },

  BACKLOG_PENDING_OVERRIDE_APPROVAL_COUNT: {
    kpiCode: 'BACKLOG_PENDING_OVERRIDE_APPROVAL_COUNT',
    displayName: 'Backlog: pending override approval (count)',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'CRITICAL',
    calculationStrategy: 'COUNT',
    aggregationStrategy: 'BY_AGING_BAND',
    drillThroughSupported: true,
    drillThroughTarget: 'OVERRIDE_SESSIONS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'OVERRIDE_SESSION', suggestedRetentionDays: 365 },
  },

  BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT: {
    kpiCode: 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT',
    displayName: 'Backlog: pending evidence completion (count)',
    governanceDomain: 'CROSS_DOMAIN',
    severity: 'HIGH',
    calculationStrategy: 'COUNT',
    aggregationStrategy: 'BY_AGING_BAND',
    drillThroughSupported: true,
    drillThroughTarget: 'JOURNALS',
    trendSupport: true,
    visibilityRules: {
      requiredAnyPermissions: [
        PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
        PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
      ],
      allowDomains: 'ANY',
    },
    retentionScope: { source: 'EVIDENCE', suggestedRetentionDays: 365 },
  },
};
