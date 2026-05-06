import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ResolvedAccountAsOf = {
  accountId: string;
  resolvedParentAccountId: string | null;
  resolvedIfrsMappingCode: string | null;
  resolvedFsMappingLevel1: string | null;
  resolvedFsMappingLevel2: string | null;
  appliedReclassificationId: string | null;
  appliedEffectiveStartDate: string | null;
};

@Injectable()
export class CoaReclassificationResolverService {
  constructor(private readonly prisma: PrismaService) {}

  private parseAsUtcDateOnly(asOfDate: string | Date) {
    const d = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
    if (Number.isNaN(d.getTime())) {
      throw new Error('Invalid asOfDate');
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  async resolveAccountAsOfDate(params: {
    tenantId: string;
    accountId: string;
    asOfDate: string | Date;
  }): Promise<ResolvedAccountAsOf> {
    const out = await this.resolveAccountsAsOfDateBulk({
      tenantId: params.tenantId,
      accountIds: [params.accountId],
      asOfDate: params.asOfDate,
    });

    return (
      out.get(params.accountId) ?? {
        accountId: params.accountId,
        resolvedParentAccountId: null,
        resolvedIfrsMappingCode: null,
        resolvedFsMappingLevel1: null,
        resolvedFsMappingLevel2: null,
        appliedReclassificationId: null,
        appliedEffectiveStartDate: null,
      }
    );
  }

  async resolveAccountsAsOfDateBulk(params: {
    tenantId: string;
    accountIds: string[];
    asOfDate: string | Date;
  }): Promise<Map<string, ResolvedAccountAsOf>> {
    const accountIds = [...new Set(params.accountIds)].filter(Boolean);
    const out = new Map<string, ResolvedAccountAsOf>();

    if (accountIds.length === 0) {
      return out;
    }

    const asOf = this.parseAsUtcDateOnly(params.asOfDate);

    const [accounts, reclasses] = await Promise.all([
      this.prisma.account.findMany({
        where: { tenantId: params.tenantId, id: { in: accountIds } },
        select: {
          id: true,
          parentAccountId: true,
          ifrsMappingCode: true,
          fsMappingLevel1: true,
          fsMappingLevel2: true,
        },
      }),
      this.prisma.cOAReclassification.findMany({
        where: {
          tenantId: params.tenantId,
          accountId: { in: accountIds },
          status: 'APPROVED',
          effectiveStartDate: { lte: asOf },
        },
        orderBy: [{ accountId: 'asc' }, { effectiveStartDate: 'desc' }],
        select: {
          id: true,
          accountId: true,
          effectiveStartDate: true,
          newParentAccountId: true,
          newIfrsMappingCode: true,
          newFsMappingLevel1: true,
          newFsMappingLevel2: true,
        },
      }),
    ]);

    const baseById = new Map(accounts.map((a) => [a.id, a] as const));

    const latestByAccountId = new Map<
      string,
      {
        id: string;
        effectiveStartDate: Date;
        newParentAccountId: string | null;
        newIfrsMappingCode: string | null;
        newFsMappingLevel1: string | null;
        newFsMappingLevel2: string | null;
      }
    >();

    for (const r of reclasses) {
      if (!latestByAccountId.has(r.accountId)) {
        latestByAccountId.set(r.accountId, {
          id: r.id,
          effectiveStartDate: r.effectiveStartDate,
          newParentAccountId: r.newParentAccountId ?? null,
          newIfrsMappingCode: r.newIfrsMappingCode ?? null,
          newFsMappingLevel1: r.newFsMappingLevel1 ?? null,
          newFsMappingLevel2: r.newFsMappingLevel2 ?? null,
        });
      }
    }

    for (const id of accountIds) {
      const base = baseById.get(id);
      if (!base) continue;

      const overlay = latestByAccountId.get(id) ?? null;

      out.set(id, {
        accountId: id,
        resolvedParentAccountId:
          overlay?.newParentAccountId ?? base.parentAccountId ?? null,
        resolvedIfrsMappingCode:
          overlay?.newIfrsMappingCode ?? base.ifrsMappingCode ?? null,
        resolvedFsMappingLevel1:
          overlay?.newFsMappingLevel1 ?? base.fsMappingLevel1 ?? null,
        resolvedFsMappingLevel2:
          overlay?.newFsMappingLevel2 ?? base.fsMappingLevel2 ?? null,
        appliedReclassificationId: overlay?.id ?? null,
        appliedEffectiveStartDate: overlay
          ? overlay.effectiveStartDate.toISOString().slice(0, 10)
          : null,
      });
    }

    return out;
  }
}
