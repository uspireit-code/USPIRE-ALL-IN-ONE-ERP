import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  computeGovernanceKpi,
  computeGovernanceKpiTrend,
  type GovernanceKpiQueryFilters,
  type GovernanceKpiTrendBucket,
} from './governance-kpi-engine';
import {
  getGovernanceKpiDefinition,
  GOVERNANCE_KPI_REGISTRY,
  type GovernanceKpiDefinition,
} from './kpi-governance-registry';

export interface GovernanceKpiSummaryQuery {
  kpiCodes?: string[];
  from: string;
  to: string;
  filters?: GovernanceKpiQueryFilters;
}

export interface GovernanceKpiTrendQuery {
  kpiCode: string;
  from: string;
  to: string;
  bucket: GovernanceKpiTrendBucket;
  filters?: GovernanceKpiQueryFilters;
}

@Injectable()
export class GovernanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  listKpis(): GovernanceKpiDefinition[] {
    return Object.values(GOVERNANCE_KPI_REGISTRY);
  }

  private toDate(value: string, label: string) {
    const v = String(value ?? '').trim();
    if (!v) throw new BadRequestException(`${label} is required`);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${label}`);
    return d;
  }

  async getKpiSummaries(params: {
    tenantId: string;
    query: GovernanceKpiSummaryQuery;
  }) {
    const from = this.toDate(params.query.from, 'from');
    const to = this.toDate(params.query.to, 'to');

    const codes =
      Array.isArray(params.query.kpiCodes) && params.query.kpiCodes.length > 0
        ? params.query.kpiCodes.map((c) => String(c).trim()).filter(Boolean)
        : Object.keys(GOVERNANCE_KPI_REGISTRY);

    const results = [] as any[];

    for (const code of codes) {
      const def = getGovernanceKpiDefinition(code);
      if (!def) continue;

      const computed = await computeGovernanceKpi({
        prisma: this.prisma,
        tenantId: params.tenantId,
        kpiCode: def.kpiCode,
        from,
        to,
        filters: params.query.filters,
      });

      results.push({
        definition: def,
        result: computed,
      });
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      count: results.length,
      results,
    };
  }

  async getKpiTrend(params: {
    tenantId: string;
    query: GovernanceKpiTrendQuery;
  }) {
    const def = getGovernanceKpiDefinition(params.query.kpiCode);
    if (!def) throw new BadRequestException(`Unknown kpiCode: ${params.query.kpiCode}`);

    const from = this.toDate(params.query.from, 'from');
    const to = this.toDate(params.query.to, 'to');

    const points = await computeGovernanceKpiTrend({
      prisma: this.prisma,
      tenantId: params.tenantId,
      kpiCode: def.kpiCode,
      from,
      to,
      bucket: params.query.bucket,
      filters: params.query.filters,
    });

    return {
      definition: def,
      from: from.toISOString(),
      to: to.toISOString(),
      bucket: params.query.bucket,
      points,
    };
  }

  async drillThrough(params: {
    tenantId: string;
    kpiCode: string;
    from: string;
    to: string;
    filters?: GovernanceKpiQueryFilters;
    take?: number;
  }) {
    const def = getGovernanceKpiDefinition(params.kpiCode);
    if (!def) throw new BadRequestException(`Unknown kpiCode: ${params.kpiCode}`);
    if (!def.drillThroughSupported || !def.drillThroughTarget) {
      throw new BadRequestException('Drill-through not supported for this KPI');
    }

    const fromDate = this.toDate(params.from, 'from');
    const toDate = this.toDate(params.to, 'to');
    const take = Math.max(1, Math.min(500, Math.floor(Number(params.take ?? 100))));

    const f = params.filters ?? {};

    if (def.drillThroughTarget === 'JOURNALS') {
      const where: any = {
        tenantId: params.tenantId,
      };

      if (def.kpiCode === 'BACKLOG_PENDING_REVIEW_COUNT') {
        where.status = 'SUBMITTED';
        where.submittedAt = { not: null, lt: toDate };
      } else if (def.kpiCode === 'BACKLOG_PENDING_APPROVAL_COUNT') {
        where.status = 'REVIEWED';
        where.submittedAt = { not: null, lt: toDate };
      } else if (def.kpiCode === 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT') {
        where.status = { in: ['SUBMITTED', 'REVIEWED'] };
        where.submittedAt = { not: null, lt: toDate };
      } else {
        where.submittedAt = { gte: fromDate, lt: toDate };
      }

      if (f.lifecycleState) where.status = String(f.lifecycleState);

      const rows = await (this.prisma as any).journalEntry.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take,
        select: {
          id: true,
          journalNumber: true,
          journalType: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          reviewedAt: true,
          approvedAt: true,
          rejectedAt: true,
          createdById: true,
          submittedById: true,
          reviewedById: true,
          approvedById: true,
          rejectedById: true,
          periodId: true,
          sourceType: true,
          sourceId: true,
          riskScore: true,
        },
      });

      if (def.kpiCode !== 'BACKLOG_PENDING_EVIDENCE_COMPLETION_COUNT') {
        return { target: def.drillThroughTarget, count: rows.length, rows };
      }

      const ids = rows.map((r: any) => String(r.id));
      const ev = await (this.prisma as any).auditEvidence.findMany({
        where: {
          tenantId: params.tenantId,
          entityType: 'JOURNAL_ENTRY',
          entityId: { in: ids },
        },
        select: { entityId: true },
        take: 5000,
      });
      const hasEvidence = new Set<string>((ev ?? []).map((e: any) => String(e.entityId)));
      const filtered = rows.filter((r: any) => !hasEvidence.has(String(r.id)));

      return { target: def.drillThroughTarget, count: filtered.length, rows: filtered };
    }

    if (def.drillThroughTarget === 'AUTOMATION_EXECUTION_SESSIONS') {
      const where: any = {
        tenantId: params.tenantId,
        startedAt: { gte: fromDate, lt: toDate },
      };
      if (f.automationCode) where.automationCode = String(f.automationCode);
      if (f.actorType) where.actorType = String(f.actorType);
      if (f.governanceDomain) where.governanceDomain = String(f.governanceDomain);
      if (f.severity) where.severity = String(f.severity);

      const rows = await (this.prisma as any).governanceAutomationExecutionSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take,
      });

      return { target: def.drillThroughTarget, count: rows.length, rows };
    }

    if (def.drillThroughTarget === 'AUTOMATION_SCHEDULES') {
      const where: any = {
        tenantId: params.tenantId,
        updatedAt: { gte: fromDate, lt: toDate },
      };
      if (f.automationCode) where.automationCode = String(f.automationCode);
      if (f.lifecycleState) where.scheduleStatus = String(f.lifecycleState);

      const rows = await (this.prisma as any).governanceAutomationSchedule.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      });

      return { target: def.drillThroughTarget, count: rows.length, rows };
    }

    if (def.drillThroughTarget === 'OVERRIDE_SESSIONS') {
      const where: any = {
        tenantId: params.tenantId,
        createdAt: { gte: fromDate, lt: toDate },
      };
      if (f.overrideCode) where.overrideCode = String(f.overrideCode);
      if (f.lifecycleState) where.status = String(f.lifecycleState);

      const rows = await (this.prisma as any).governanceOverrideSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });

      return { target: def.drillThroughTarget, count: rows.length, rows };
    }

    if (def.drillThroughTarget === 'AUDIT_EVIDENCE') {
      const where: any = {
        tenantId: params.tenantId,
        createdAt: { gte: fromDate, lt: toDate },
      };
      if (f.governanceDomain) where.governanceDomain = String(f.governanceDomain);

      const rows = await (this.prisma as any).auditEvidence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });

      return { target: def.drillThroughTarget, count: rows.length, rows };
    }

    if (def.drillThroughTarget === 'AUDIT_EVENTS') {
      const where: any = {
        tenantId: params.tenantId,
        createdAt: { gte: fromDate, lt: toDate },
      };

      const rows = await (this.prisma as any).auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });

      return { target: def.drillThroughTarget, count: rows.length, rows };
    }

    throw new BadRequestException('Unsupported drill-through target');
  }
}
