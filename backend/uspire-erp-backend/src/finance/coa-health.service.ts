import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

function clampScore(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

@Injectable()
export class CoaHealthService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureTenant(req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant?.id) throw new BadRequestException('Missing tenant context');
    return tenant as { id: string };
  }

  async getHealth(req: Request) {
    const tenant = this.ensureTenant(req);
    const tenantId = tenant.id;

    const now = new Date();

    const [
      totalAccountCount,
      postingAccountCount,
      missingIfrsCount,
      statusGroups,
      pendingApprovalRequestCount,
      pendingStructureChangeRequestCount,
      futureDatedStructuralChangeCount,
      freezeState,
    ] = await Promise.all([
      this.prisma.account.count({ where: { tenantId } }),
      this.prisma.account.count({ where: { tenantId, isPosting: true } }),
      this.prisma.account.count({ where: { tenantId, isPosting: true, ifrsNodeId: null } }),
      this.prisma.account.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }) as any,
      (this.prisma as any).cOAApprovalRequest.count({ where: { tenantId, status: 'PENDING' } } as any),
      (this.prisma as any).coaStructureChangeRequest.count({ where: { tenantId, status: 'SUBMITTED' } } as any),
      (this.prisma as any).coaStructuralChange.count({ where: { tenantId, isActive: true, effectiveFrom: { gt: now } } } as any),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          coaStructureFrozen: true,
          coaStructureFrozenAt: true,
          coaStructureFrozenByUserId: true,
          coaStructureFreezeEffectiveDate: true,
        } as any,
      }) as any,
    ]);

    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      BLOCKED: 0,
      RETIRED: 0,
    };
    for (const g of statusGroups ?? []) {
      const k = String(g?.status ?? '').toUpperCase();
      if (k && statusCounts[k] !== undefined) statusCounts[k] = Number(g?._count?._all ?? 0);
    }

    // Structural anomalies.
    // - orphan: has parentAccountId but parent missing
    // - invalid parent: parent exists but isPosting = true
    const orphanAccountCountRow = (await this.prisma.$queryRawUnsafe(
      `select count(*)::int as c
       from "Account" a
       left join "Account" p
         on p.id = a."parentAccountId" and p."tenantId" = a."tenantId"
      where a."tenantId" = $1
        and a."parentAccountId" is not null
        and p.id is null`,
      tenantId,
    )) as Array<{ c: number }>;

    const invalidParentCountRow = (await this.prisma.$queryRawUnsafe(
      `select count(*)::int as c
       from "Account" a
       join "Account" p
         on p.id = a."parentAccountId" and p."tenantId" = a."tenantId"
      where a."tenantId" = $1
        and a."parentAccountId" is not null
        and p."isPosting" = true`,
      tenantId,
    )) as Array<{ c: number }>;

    const orphanAccountCount = Number(orphanAccountCountRow?.[0]?.c ?? 0);
    const invalidParentCount = Number(invalidParentCountRow?.[0]?.c ?? 0);

    // Duplicate code count: schema enforces unique([tenantId, code]) so this should be 0,
    // but we still compute defensively.
    const duplicateCodeCountRow = (await this.prisma.$queryRawUnsafe(
      `select count(*)::int as c
       from (
         select "code"
         from "Account"
         where "tenantId" = $1
         group by "code"
         having count(*) > 1
       ) x`,
      tenantId,
    )) as Array<{ c: number }>;

    const duplicateCodeCount = Number(duplicateCodeCountRow?.[0]?.c ?? 0);

    // Duplicate normalized name count: groups of duplicate normalized names.
    const duplicateNormalizedNameCountRow = (await this.prisma.$queryRawUnsafe(
      `select count(*)::int as c
       from (
         select regexp_replace(lower(trim("name")), '\\s+', ' ', 'g') as n
         from "Account"
         where "tenantId" = $1
         group by n
         having count(*) > 1
       ) x`,
      tenantId,
    )) as Array<{ c: number }>;

    const duplicateNormalizedNameCount = Number(duplicateNormalizedNameCountRow?.[0]?.c ?? 0);

    const coaStructureFrozen = Boolean(freezeState?.coaStructureFrozen);

    const ifrsCompletenessScore = clampScore(
      100 - safeRate(missingIfrsCount, Math.max(1, postingAccountCount)) * 100,
    );

    const structuralIntegrityScore = clampScore(
      100 - safeRate(orphanAccountCount + invalidParentCount, Math.max(1, totalAccountCount)) * 100,
    );

    const namingQualityScore = clampScore(
      100 - safeRate(duplicateNormalizedNameCount + duplicateCodeCount, Math.max(1, totalAccountCount)) * 100,
    );

    const lifecycleHygieneScore = clampScore(
      100 - safeRate(statusCounts.DRAFT + statusCounts.BLOCKED, Math.max(1, totalAccountCount)) * 100,
    );

    const governanceWorkflowScore = clampScore(
      100 - safeRate(pendingApprovalRequestCount + pendingStructureChangeRequestCount, Math.max(1, totalAccountCount)) * 100,
    );

    const healthScore = clampScore(
      ifrsCompletenessScore * 0.25 +
        structuralIntegrityScore * 0.25 +
        namingQualityScore * 0.15 +
        lifecycleHygieneScore * 0.15 +
        governanceWorkflowScore * 0.2,
    );

    return {
      healthScore,
      scoreBreakdown: {
        ifrsCompletenessScore,
        structuralIntegrityScore,
        namingQualityScore,
        lifecycleHygieneScore,
        governanceWorkflowScore,
      },
      summary: {
        totalAccountCount,
        postingAccountCount,
        statusCounts,
      },
      completeness: {
        postingAccountsMissingIfrsNodeCount: missingIfrsCount,
      },
      naming: {
        duplicateCodeCount,
        duplicateNormalizedNameCount,
      },
      structural: {
        orphanAccountCount,
        invalidParentCount,
      },
      governance: {
        pendingApprovalRequestCount,
        pendingStructureChangeRequestCount,
        futureDatedStructuralChangeCount,
      },
      structureFreeze: {
        coaStructureFrozen,
        coaStructureFrozenAt: freezeState?.coaStructureFrozenAt ?? null,
        coaStructureFrozenByUserId: freezeState?.coaStructureFrozenByUserId ?? null,
        coaStructureFreezeEffectiveDate: freezeState?.coaStructureFreezeEffectiveDate ?? null,
      },
      generatedAt: now.toISOString(),
    };
  }
}
