import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoaStructuralResolverService {
  constructor(private readonly prisma: PrismaService) {}

  private parseAsOfDate(raw: string | Date) {
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid asOfDate');
    }
    return d;
  }

  async resolveParent(params: { tenantId: string; accountId: string; asOfDate: string | Date }) {
    const asOfDate = this.parseAsOfDate(params.asOfDate);

    const row = await (this.prisma as any).coaStructuralChange.findFirst({
      where: {
        tenantId: params.tenantId,
        accountId: params.accountId,
        changeType: 'HIERARCHY_RECLASSIFICATION',
        isActive: true,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      } as any,
      orderBy: [{ effectiveFrom: 'desc' }],
      select: { newParentAccountId: true } as any,
    });

    return row?.newParentAccountId ?? null;
  }

  async resolveIfrsNode(params: { tenantId: string; accountId: string; asOfDate: string | Date }) {
    const asOfDate = this.parseAsOfDate(params.asOfDate);

    const row = await (this.prisma as any).coaStructuralChange.findFirst({
      where: {
        tenantId: params.tenantId,
        accountId: params.accountId,
        changeType: 'IFRS_RECLASSIFICATION',
        isActive: true,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      } as any,
      orderBy: [{ effectiveFrom: 'desc' }],
      select: { newIfrsNodeId: true } as any,
    });

    return row?.newIfrsNodeId ?? null;
  }

  async applyOverrides<T extends { id: string; parentAccountId?: string | null; ifrsNodeId?: string | null }>(params: {
    tenantId: string;
    accounts: T[];
    asOfDate: string | Date;
  }) {
    const asOfDate = this.parseAsOfDate(params.asOfDate);

    const changes = await (this.prisma as any).coaStructuralChange.findMany({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      } as any,
      orderBy: [{ effectiveFrom: 'desc' }],
      select: {
        accountId: true,
        changeType: true,
        effectiveFrom: true,
        newParentAccountId: true,
        newIfrsNodeId: true,
      } as any,
    });

    const latestByKey = new Map<string, any>();
    for (const c of changes ?? []) {
      const key = `${c.accountId}::${c.changeType}`;
      if (!latestByKey.has(key)) {
        latestByKey.set(key, c);
      }
    }

    return params.accounts.map((a) => {
      const hierarchy = latestByKey.get(`${a.id}::HIERARCHY_RECLASSIFICATION`);
      const ifrs = latestByKey.get(`${a.id}::IFRS_RECLASSIFICATION`);
      return {
        ...a,
        parentAccountId:
          hierarchy?.newParentAccountId !== undefined && hierarchy?.newParentAccountId !== null
            ? String(hierarchy.newParentAccountId)
            : (a.parentAccountId ?? null),
        ifrsNodeId:
          ifrs?.newIfrsNodeId !== undefined && ifrs?.newIfrsNodeId !== null
            ? String(ifrs.newIfrsNodeId)
            : (a.ifrsNodeId ?? null),
      };
    });
  }

  async buildHierarchyTree(params: {
    tenantId: string;
    asOfDate: string | Date;
  }): Promise<any[]> {
    const asOfDate = this.parseAsOfDate(params.asOfDate);

    const rows = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentAccountId: true,
        isPosting: true,
        isActive: true,
        ifrsNodeId: true,
      },
    });

    const resolvedRows = await this.applyOverrides({
      tenantId: params.tenantId,
      accounts: rows as any,
      asOfDate,
    });

    const nodeById = new Map<string, any>();
    for (const r of resolvedRows as any[]) {
      nodeById.set(r.id, {
        ...r,
        parentAccountId: r.parentAccountId ?? null,
        children: [],
      });
    }

    const roots: any[] = [];
    for (const n of nodeById.values()) {
      if (n.parentAccountId && nodeById.has(n.parentAccountId)) {
        nodeById.get(n.parentAccountId)!.children.push(n);
      } else {
        roots.push(n);
      }
    }

    return roots;
  }
}
