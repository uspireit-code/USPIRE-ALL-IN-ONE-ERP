import { apiFetch } from './api';

export type GovernanceKpiTrendBucket = 'DAY' | 'WEEK' | 'MONTH';

export type GovernanceKpiDrillThroughTarget =
  | 'JOURNALS'
  | 'AUTOMATION_EXECUTION_SESSIONS'
  | 'AUTOMATION_SCHEDULES'
  | 'OVERRIDE_SESSIONS'
  | 'AUDIT_EVENTS'
  | 'AUDIT_EVIDENCE';

export interface GovernanceKpiDefinition {
  kpiCode: string;
  displayName: string;
  governanceDomain: string;
  severity: string;
  calculationStrategy: string;
  aggregationStrategy: string;
  drillThroughSupported: boolean;
  drillThroughTarget?: GovernanceKpiDrillThroughTarget;
  alertThresholds?: { warn?: number; critical?: number };
  trendSupport: boolean;
  visibilityRules?: any;
  retentionScope?: any;
}

export interface GovernanceKpiResult {
  kpiCode: string;
  value: number;
  numerator?: number;
  denominator?: number;
  breakdown?: Array<{ key: string; value: number; numerator?: number; denominator?: number }>;
  drillThrough?: { target: GovernanceKpiDrillThroughTarget; filters: any; from: string; to: string };
}

export async function listGovernanceKpis(): Promise<GovernanceKpiDefinition[]> {
  return apiFetch<GovernanceKpiDefinition[]>('/governance/analytics/kpis');
}

export async function getGovernanceKpiSummaries(params: {
  from: string;
  to: string;
  kpiCodes?: string[];
  filters?: any;
}) {
  return apiFetch<{
    from: string;
    to: string;
    count: number;
    results: Array<{ definition: GovernanceKpiDefinition; result: GovernanceKpiResult }>;
  }>('/governance/analytics/kpis/summary', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getGovernanceKpiTrend(params: {
  kpiCode: string;
  from: string;
  to: string;
  bucket: GovernanceKpiTrendBucket;
  filters?: any;
}) {
  return apiFetch<{
    definition: GovernanceKpiDefinition;
    from: string;
    to: string;
    bucket: GovernanceKpiTrendBucket;
    points: Array<{ ts: string; value: number; numerator?: number; denominator?: number }>;
  }>('/governance/analytics/kpis/trend', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function drillGovernanceKpi(params: {
  kpiCode: string;
  from: string;
  to: string;
  take?: number;
  automationCode?: string;
  overrideCode?: string;
  governanceDomain?: string;
  severity?: string;
  actorType?: string;
  lifecycleState?: string;
}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    query.set(k, String(v));
  }
  return apiFetch<{ target: GovernanceKpiDrillThroughTarget; count: number; rows: any[] }>(
    `/governance/analytics/kpis/drill?${query.toString()}`,
  );
}
