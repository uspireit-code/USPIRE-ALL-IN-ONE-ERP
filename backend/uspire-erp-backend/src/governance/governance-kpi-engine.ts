import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import type {
  GovernanceKpiAggregationStrategy,
  GovernanceKpiDrillThroughTarget,
} from './kpi-governance-registry';
import { getGovernanceKpiDefinition } from './kpi-governance-registry';

export type GovernanceKpiTrendBucket = 'DAY' | 'WEEK' | 'MONTH';

export interface GovernanceKpiQueryFilters {
  governanceDomain?: string;
  severity?: string;
  automationCode?: string;
  overrideCode?: string;
  legalEntity?: string;
  actorType?: string;
  lifecycleState?: string;
}

export interface GovernanceKpiComputeParams {
  prisma: PrismaService;
  tenantId: string;
  kpiCode: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  aggregationStrategy?: GovernanceKpiAggregationStrategy;
}

export interface GovernanceKpiPoint {
  ts: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

export interface GovernanceKpiBreakdownRow {
  key: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

export interface GovernanceKpiDrillThroughSpec {
  target: GovernanceKpiDrillThroughTarget;
  filters: GovernanceKpiQueryFilters;
  from: string;
  to: string;
}

export interface GovernanceKpiResult {
  kpiCode: string;
  value: number;
  numerator?: number;
  denominator?: number;
  breakdown?: GovernanceKpiBreakdownRow[];
  drillThrough?: GovernanceKpiDrillThroughSpec;
}

function toDateStrict(value: any, label: string): Date {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${label}`);
  return d;
}

function clampToRange(params: { from: Date; to: Date }) {
  const from = params.from;
  const to = params.to;
  if (to.getTime() < from.getTime()) throw new BadRequestException('to must be >= from');
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (days > 370) throw new BadRequestException('Time window too large (max 370 days)');
}

function buildExecutionWhere(params: {
  tenantId: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  base?: any;
}) {
  const where: any = {
    tenantId: params.tenantId,
    startedAt: {
      gte: params.from,
      lt: params.to,
    },
    ...(params.base ?? {}),
  };

  if (params.filters?.automationCode) where.automationCode = String(params.filters.automationCode);
  if (params.filters?.actorType) where.actorType = String(params.filters.actorType);

  if (params.filters?.governanceDomain) where.governanceDomain = String(params.filters.governanceDomain);
  if (params.filters?.severity) where.severity = String(params.filters.severity);

  return where;
}

function buildJournalWhere(params: {
  tenantId: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  base?: any;
}) {
  const where: any = {
    tenantId: params.tenantId,
    submittedAt: {
      gte: params.from,
      lt: params.to,
    },
    ...(params.base ?? {}),
  };

  if (params.filters?.lifecycleState) where.status = String(params.filters.lifecycleState);

  return where;
}

function buildOverrideWhere(params: {
  tenantId: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  base?: any;
}) {
  const where: any = {
    tenantId: params.tenantId,
    createdAt: {
      gte: params.from,
      lt: params.to,
    },
    ...(params.base ?? {}),
  };

  if (params.filters?.overrideCode) where.overrideCode = String(params.filters.overrideCode);

  return where;
}

function buildAuditEventWhere(params: {
  tenantId: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  base?: any;
}) {
  const where: any = {
    tenantId: params.tenantId,
    createdAt: {
      gte: params.from,
      lt: params.to,
    },
    ...(params.base ?? {}),
  };

  return where;
}

function buildEvidenceWhere(params: {
  tenantId: string;
  from: Date;
  to: Date;
  filters?: GovernanceKpiQueryFilters;
  base?: any;
}) {
  const where: any = {
    tenantId: params.tenantId,
    createdAt: {
      gte: params.from,
      lt: params.to,
    },
    ...(params.base ?? {}),
  };

  if (params.filters?.governanceDomain) where.governanceDomain = String(params.filters.governanceDomain);
  if (params.filters?.severity) where.auditSensitivity = String(params.filters.severity);

  return where;
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return numerator / denominator;
}

function ageBandBySeconds(seconds: number): 'LT_1D' | 'D1_3' | 'D3_7' | 'GT_7D' {
  if (seconds < 86400) return 'LT_1D';
  if (seconds < 3 * 86400) return 'D1_3';
  if (seconds < 7 * 86400) return 'D3_7';
  return 'GT_7D';
}

function dateBucketKey(params: { bucket: GovernanceKpiTrendBucket; date: Date }) {
  const d = params.date;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (params.bucket === 'DAY') return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (params.bucket === 'WEEK') {
    const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
}

function bucketSeries(params: { from: Date; to: Date; bucket: GovernanceKpiTrendBucket }) {
  const keys: string[] = [];
  const d = new Date(Date.UTC(params.from.getUTCFullYear(), params.from.getUTCMonth(), params.from.getUTCDate()));
  while (d.getTime() < params.to.getTime()) {
    keys.push(dateBucketKey({ bucket: params.bucket, date: d }));
    if (params.bucket === 'DAY') d.setUTCDate(d.getUTCDate() + 1);
    else if (params.bucket === 'WEEK') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
}

export async function computeGovernanceKpi(params: GovernanceKpiComputeParams): Promise<GovernanceKpiResult> {
  const def = getGovernanceKpiDefinition(params.kpiCode);
  if (!def) throw new BadRequestException(`Unknown kpiCode: ${params.kpiCode}`);

  const from = toDateStrict(params.from, 'from');
  const to = toDateStrict(params.to, 'to');
  clampToRange({ from, to });

  const aggregation = params.aggregationStrategy ?? def.aggregationStrategy;

  if (def.kpiCode === 'REVIEW_TURNAROUND_AVG_SECONDS') {
    const rows = await (params.prisma as any).journalEntry.findMany({
      where: buildJournalWhere({
        tenantId: params.tenantId,
        from,
        to,
        filters: params.filters,
        base: { status: { in: ['REVIEWED', 'REJECTED', 'POSTED'] } },
      }),
      select: { id: true, submittedAt: true, reviewedAt: true, status: true },
      take: 5000,
      orderBy: { submittedAt: 'desc' },
    });

    let sum = 0;
    let count = 0;
    for (const r of rows ?? []) {
      const submittedAt = r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt);
      const reviewedAt = r.reviewedAt ? (r.reviewedAt instanceof Date ? r.reviewedAt : new Date(r.reviewedAt)) : null;
      if (!reviewedAt) continue;
      const seconds = (reviewedAt.getTime() - submittedAt.getTime()) / 1000;
      if (Number.isNaN(seconds) || seconds < 0) continue;
      sum += seconds;
      count += 1;
    }

    return {
      kpiCode: def.kpiCode,
      value: count ? sum / count : 0,
      numerator: sum,
      denominator: count,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'JOURNALS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };
  }

  if (def.kpiCode === 'DECISION_RESOLUTION_AVG_SECONDS') {
    const rows = await (params.prisma as any).journalEntry.findMany({
      where: buildJournalWhere({
        tenantId: params.tenantId,
        from,
        to,
        filters: params.filters,
        base: {
          OR: [{ approvedAt: { not: null } }, { rejectedAt: { not: null } }],
        },
      }),
      select: { id: true, submittedAt: true, approvedAt: true, rejectedAt: true, status: true },
      take: 5000,
      orderBy: { submittedAt: 'desc' },
    });

    let sum = 0;
    let count = 0;
    for (const r of rows ?? []) {
      const submittedAt = r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt);
      const approvedAt = r.approvedAt ? (r.approvedAt instanceof Date ? r.approvedAt : new Date(r.approvedAt)) : null;
      const rejectedAt = r.rejectedAt ? (r.rejectedAt instanceof Date ? r.rejectedAt : new Date(r.rejectedAt)) : null;
      const resolvedAt = approvedAt ?? rejectedAt;
      if (!resolvedAt) continue;
      const seconds = (resolvedAt.getTime() - submittedAt.getTime()) / 1000;
      if (Number.isNaN(seconds) || seconds < 0) continue;
      sum += seconds;
      count += 1;
    }

    return {
      kpiCode: def.kpiCode,
      value: count ? sum / count : 0,
      numerator: sum,
      denominator: count,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'JOURNALS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };
  }

  if (
    def.kpiCode === 'BACKLOG_PENDING_REVIEW_COUNT' ||
    def.kpiCode === 'BACKLOG_PENDING_APPROVAL_COUNT' ||
    def.kpiCode === 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT'
  ) {
    const asOf = to;

    const baseWhere: any = {
      tenantId: params.tenantId,
      submittedAt: { not: null, lt: asOf },
    };

    if (def.kpiCode === 'BACKLOG_PENDING_REVIEW_COUNT') {
      baseWhere.status = 'SUBMITTED';
    }

    if (def.kpiCode === 'BACKLOG_PENDING_APPROVAL_COUNT') {
      baseWhere.status = 'REVIEWED';
    }

    if (def.kpiCode === 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT') {
      baseWhere.status = { in: ['SUBMITTED', 'REVIEWED'] };
    }

    const rows = await (params.prisma as any).journalEntry.findMany({
      where: baseWhere,
      select: { id: true, submittedAt: true, status: true },
      take: 5000,
      orderBy: { submittedAt: 'asc' },
    });

    let filtered = rows ?? [];

    if (def.kpiCode === 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT') {
      const ids = filtered.map((x: any) => String(x.id));
      const evidenceRows = await (params.prisma as any).auditEvidence.findMany({
        where: {
          tenantId: params.tenantId,
          entityType: 'JOURNAL_ENTRY',
          entityId: { in: ids },
        },
        select: { entityId: true },
        take: 5000,
      });
      const hasEvidence = new Set<string>((evidenceRows ?? []).map((e: any) => String(e.entityId)));
      filtered = filtered.filter((j: any) => !hasEvidence.has(String(j.id)));
    }

    const total = filtered.length;

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: total,
      numerator: total,
      denominator: 1,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'JOURNALS',
            filters: {
              ...(params.filters ?? {}),
              lifecycleState:
                def.kpiCode === 'BACKLOG_PENDING_REVIEW_COUNT'
                  ? 'SUBMITTED'
                  : def.kpiCode === 'BACKLOG_PENDING_APPROVAL_COUNT'
                    ? 'REVIEWED'
                    : (params.filters?.lifecycleState ?? undefined),
            },
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_AGING_BAND') {
      const bandCounts: Record<string, number> = {
        LT_1D: 0,
        D1_3: 0,
        D3_7: 0,
        GT_7D: 0,
      };
      for (const r of filtered) {
        const submittedAt = r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt);
        const seconds = (asOf.getTime() - submittedAt.getTime()) / 1000;
        if (Number.isNaN(seconds) || seconds < 0) continue;
        bandCounts[ageBandBySeconds(seconds)] += 1;
      }
      res.breakdown = Object.entries(bandCounts).map(([k, v]) => ({ key: k, value: v }));
    }

    return res;
  }

  if (def.kpiCode === 'BACKLOG_PENDING_OVERRIDE_APPROVAL_COUNT') {
    const asOf = to;
    const rows = await (params.prisma as any).governanceOverrideSession.findMany({
      where: {
        tenantId: params.tenantId,
        status: 'REQUESTED',
        createdAt: { lt: asOf },
      },
      select: { id: true, createdAt: true, overrideCode: true, status: true },
      take: 5000,
      orderBy: { createdAt: 'asc' },
    });

    const total = (rows ?? []).length;

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: total,
      numerator: total,
      denominator: 1,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'OVERRIDE_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_AGING_BAND') {
      const bandCounts: Record<string, number> = {
        LT_1D: 0,
        D1_3: 0,
        D3_7: 0,
        GT_7D: 0,
      };
      for (const r of rows ?? []) {
        const createdAt = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
        const seconds = (asOf.getTime() - createdAt.getTime()) / 1000;
        if (Number.isNaN(seconds) || seconds < 0) continue;
        bandCounts[ageBandBySeconds(seconds)] += 1;
      }
      res.breakdown = Object.entries(bandCounts).map(([k, v]) => ({ key: k, value: v }));
    }

    return res;
  }

  if (def.kpiCode === 'OVERRIDE_FREQUENCY') {
    const totalOverrides = await (params.prisma as any).governanceOverrideSession.count({
      where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });
    const totalAuditEvents = await (params.prisma as any).auditEvent.count({
      where: buildAuditEventWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: safeRate(totalOverrides, totalAuditEvents),
      numerator: totalOverrides,
      denominator: totalAuditEvents,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'OVERRIDE_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_OVERRIDE_CODE') {
      const grouped = await (params.prisma as any).governanceOverrideSession.groupBy({
        by: ['overrideCode'],
        where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
        _count: { _all: true },
      });
      res.breakdown = (grouped ?? []).map((g: any) => ({
        key: String(g.overrideCode ?? 'UNKNOWN'),
        value: safeRate(Number(g._count?._all ?? 0), totalAuditEvents),
        numerator: Number(g._count?._all ?? 0),
        denominator: totalAuditEvents,
      }));
    }

    return res;
  }

  if (def.kpiCode === 'OVERRIDE_APPROVAL_RATE') {
    const approved = await (params.prisma as any).governanceOverrideSession.count({
      where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { status: 'APPROVED' } }),
    });
    const requested = await (params.prisma as any).governanceOverrideSession.count({
      where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: safeRate(approved, requested),
      numerator: approved,
      denominator: requested,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'OVERRIDE_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_OVERRIDE_CODE') {
      const grouped = await (params.prisma as any).governanceOverrideSession.groupBy({
        by: ['overrideCode'],
        where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
        _count: { _all: true },
      });
      const groupedApproved = await (params.prisma as any).governanceOverrideSession.groupBy({
        by: ['overrideCode'],
        where: buildOverrideWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { status: 'APPROVED' } }),
        _count: { _all: true },
      });
      const mapApproved = new Map<string, number>(
        (groupedApproved ?? []).map((g: any) => [String(g.overrideCode ?? 'UNKNOWN'), Number(g._count?._all ?? 0)]),
      );
      res.breakdown = (grouped ?? []).map((g: any) => {
        const code = String(g.overrideCode ?? 'UNKNOWN');
        const denom = Number(g._count?._all ?? 0);
        const num = Number(mapApproved.get(code) ?? 0);
        return {
          key: code,
          value: safeRate(num, denom),
          numerator: num,
          denominator: denom,
        };
      });
    }

    return res;
  }

  if (def.kpiCode === 'ESCALATION_RATE') {
    const escalations = await (params.prisma as any).auditEvent.count({
      where: buildAuditEventWhere({
        tenantId: params.tenantId,
        from,
        to,
        filters: params.filters,
        base: {
          OR: [{ reason: { contains: '"escalation"' } }, { reason: { contains: 'escalationType' } }],
        },
      }),
    });
    const total = await (params.prisma as any).auditEvent.count({
      where: buildAuditEventWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    return {
      kpiCode: def.kpiCode,
      value: safeRate(escalations, total),
      numerator: escalations,
      denominator: total,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUDIT_EVENTS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };
  }

  if (def.kpiCode === 'AUTOMATION_FAILURE_RATE') {
    const failed = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { executionStatus: 'FAILED' } }),
    });
    const total = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: safeRate(failed, total),
      numerator: failed,
      denominator: total,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUTOMATION_EXECUTION_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_AUTOMATION_CODE') {
      const grouped = await (params.prisma as any).governanceAutomationExecutionSession.groupBy({
        by: ['automationCode'],
        where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
        _count: { _all: true },
      });
      const groupedFailed = await (params.prisma as any).governanceAutomationExecutionSession.groupBy({
        by: ['automationCode'],
        where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { executionStatus: 'FAILED' } }),
        _count: { _all: true },
      });
      const mapFailed = new Map<string, number>(
        (groupedFailed ?? []).map((g: any) => [String(g.automationCode ?? 'UNKNOWN'), Number(g._count?._all ?? 0)]),
      );
      res.breakdown = (grouped ?? []).map((g: any) => {
        const code = String(g.automationCode ?? 'UNKNOWN');
        const denom = Number(g._count?._all ?? 0);
        const num = Number(mapFailed.get(code) ?? 0);
        return { key: code, value: safeRate(num, denom), numerator: num, denominator: denom };
      });
    }

    return res;
  }

  if (def.kpiCode === 'EXECUTION_SUCCESS_RATE') {
    const completed = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { executionStatus: 'COMPLETED' } }),
    });
    const total = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: safeRate(completed, total),
      numerator: completed,
      denominator: total,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUTOMATION_EXECUTION_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_AUTOMATION_CODE') {
      const grouped = await (params.prisma as any).governanceAutomationExecutionSession.groupBy({
        by: ['automationCode'],
        where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
        _count: { _all: true },
      });
      const groupedCompleted = await (params.prisma as any).governanceAutomationExecutionSession.groupBy({
        by: ['automationCode'],
        where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { executionStatus: 'COMPLETED' } }),
        _count: { _all: true },
      });
      const mapCompleted = new Map<string, number>(
        (groupedCompleted ?? []).map((g: any) => [String(g.automationCode ?? 'UNKNOWN'), Number(g._count?._all ?? 0)]),
      );
      res.breakdown = (grouped ?? []).map((g: any) => {
        const code = String(g.automationCode ?? 'UNKNOWN');
        const denom = Number(g._count?._all ?? 0);
        const num = Number(mapCompleted.get(code) ?? 0);
        return { key: code, value: safeRate(num, denom), numerator: num, denominator: denom };
      });
    }

    return res;
  }

  if (def.kpiCode === 'AUTOMATION_SUSPENSION_RATE') {
    const suspended = await (params.prisma as any).governanceAutomationSchedule.count({
      where: {
        tenantId: params.tenantId,
        updatedAt: { gte: from, lt: to },
        scheduleStatus: 'SUSPENDED',
        ...(params.filters?.automationCode ? { automationCode: String(params.filters.automationCode) } : {}),
      },
    });
    const total = await (params.prisma as any).governanceAutomationSchedule.count({
      where: {
        tenantId: params.tenantId,
        updatedAt: { gte: from, lt: to },
        ...(params.filters?.automationCode ? { automationCode: String(params.filters.automationCode) } : {}),
      },
    });

    return {
      kpiCode: def.kpiCode,
      value: safeRate(suspended, total),
      numerator: suspended,
      denominator: total,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUTOMATION_SCHEDULES',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };
  }

  if (def.kpiCode === 'SCHEDULE_EXECUTION_LATENCY_AVG_SECONDS') {
    const rows = await (params.prisma as any).governanceAutomationExecutionSession.findMany({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters, base: { scheduleId: { not: null } } }),
      select: { startedAt: true, completedAt: true, automationCode: true },
      take: 2000,
      orderBy: { startedAt: 'desc' },
    });

    const latencies = (rows ?? [])
      .map((r: any) => {
        const s = r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt);
        const c = r.completedAt ? (r.completedAt instanceof Date ? r.completedAt : new Date(r.completedAt)) : null;
        if (!c) return null;
        const diff = (c.getTime() - s.getTime()) / 1000;
        if (Number.isNaN(diff) || diff < 0) return null;
        return { automationCode: String(r.automationCode ?? 'UNKNOWN'), seconds: diff };
      })
      .filter(Boolean) as Array<{ automationCode: string; seconds: number }>;

    const sum = latencies.reduce((a, b) => a + b.seconds, 0);
    const denom = latencies.length;
    const value = denom ? sum / denom : 0;

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value,
      numerator: sum,
      denominator: denom,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUTOMATION_EXECUTION_SESSIONS',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_AUTOMATION_CODE') {
      const map = new Map<string, { sum: number; count: number }>();
      for (const l of latencies) {
        const cur = map.get(l.automationCode) ?? { sum: 0, count: 0 };
        cur.sum += l.seconds;
        cur.count += 1;
        map.set(l.automationCode, cur);
      }
      res.breakdown = [...map.entries()].map(([k, v]) => ({
        key: k,
        value: v.count ? v.sum / v.count : 0,
        numerator: v.sum,
        denominator: v.count,
      }));
    }

    return res;
  }

  if (def.kpiCode === 'EVIDENCE_COMPLIANCE_RATE') {
    const evidenceCount = await (params.prisma as any).auditEvidence.count({
      where: buildEvidenceWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const executionWithEvidence = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({
        tenantId: params.tenantId,
        from,
        to,
        filters: params.filters,
        base: {
          evidenceMetadata: { not: null },
        },
      }),
    });

    const totalExecutions = await (params.prisma as any).governanceAutomationExecutionSession.count({
      where: buildExecutionWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
    });

    const res: GovernanceKpiResult = {
      kpiCode: def.kpiCode,
      value: safeRate(executionWithEvidence, totalExecutions),
      numerator: executionWithEvidence,
      denominator: totalExecutions,
      drillThrough: def.drillThroughSupported
        ? {
            target: 'AUDIT_EVIDENCE',
            filters: params.filters ?? {},
            from: from.toISOString(),
            to: to.toISOString(),
          }
        : undefined,
    };

    if (aggregation === 'BY_GOVERNANCE_DOMAIN') {
      const grouped = await (params.prisma as any).auditEvidence.groupBy({
        by: ['governanceDomain'],
        where: buildEvidenceWhere({ tenantId: params.tenantId, from, to, filters: params.filters }),
        _count: { _all: true },
      });
      res.breakdown = (grouped ?? []).map((g: any) => ({
        key: String(g.governanceDomain ?? 'UNKNOWN'),
        value: Number(g._count?._all ?? 0),
      }));
      res.numerator = evidenceCount;
    }

    return res;
  }

  throw new BadRequestException(`KPI calculation not implemented: ${def.kpiCode}`);
}

export async function computeGovernanceKpiTrend(params: {
  prisma: PrismaService;
  tenantId: string;
  kpiCode: string;
  from: Date;
  to: Date;
  bucket: GovernanceKpiTrendBucket;
  filters?: GovernanceKpiQueryFilters;
}) {
  const from = toDateStrict(params.from, 'from');
  const to = toDateStrict(params.to, 'to');
  clampToRange({ from, to });

  const keys = bucketSeries({ from, to, bucket: params.bucket });
  const points: GovernanceKpiPoint[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    const start = i === 0 ? from : new Date(from);
    const end = new Date(from);

    if (params.bucket === 'DAY') {
      const [yy, mm, dd] = key.split('-').map((x) => Number(x));
      start.setTime(Date.UTC(yy, mm - 1, dd, 0, 0, 0));
      end.setTime(Date.UTC(yy, mm - 1, dd + 1, 0, 0, 0));
    } else if (params.bucket === 'MONTH') {
      const [yy, mm] = key.split('-').map((x) => Number(x));
      start.setTime(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
      end.setTime(Date.UTC(yy, mm, 1, 0, 0, 0));
    } else {
      const [yy, wk] = key.split('-W');
      const year = Number(yy);
      const week = Number(wk);
      const jan4 = new Date(Date.UTC(year, 0, 4, 0, 0, 0));
      const day = jan4.getUTCDay() || 7;
      const monday = new Date(jan4);
      monday.setUTCDate(jan4.getUTCDate() - day + 1);
      start.setTime(monday.getTime() + (week - 1) * 7 * 86400000);
      end.setTime(start.getTime() + 7 * 86400000);
    }

    const r = await computeGovernanceKpi({
      prisma: params.prisma,
      tenantId: params.tenantId,
      kpiCode: params.kpiCode,
      from: start,
      to: end,
      filters: params.filters,
    });

    points.push({ ts: start.toISOString(), value: r.value, numerator: r.numerator, denominator: r.denominator });
  }

  return points;
}
