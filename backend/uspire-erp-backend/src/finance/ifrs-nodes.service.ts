import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CreateIfrsNodeDto, IfrsStatementDto, UpdateIfrsNodeDto } from './ifrs-nodes.dto';

export type IfrsNodeDto = {
  id: string;
  code: string;
  name: string;
  statement: IfrsStatementDto;
  parentId: string | null;
  level: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type IfrsNodeTreeDto = IfrsNodeDto & { children: IfrsNodeTreeDto[] };

export type IfrsNodeFlatRefDto = {
  id: string;
  name: string;
  statement: IfrsStatementDto;
  fullPath: string;
  code: string;
  parentId: string | null;
  level: number | null;
};

@Injectable()
export class IfrsNodesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenant(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');
    return { tenant, user };
  }

  private buildTree(nodes: IfrsNodeDto[]): IfrsNodeTreeDto[] {
    const byId = new Map<string, IfrsNodeTreeDto>();
    for (const n of nodes) {
      byId.set(n.id, { ...n, children: [] });
    }

    const roots: IfrsNodeTreeDto[] = [];
    for (const n of nodes) {
      const item = byId.get(n.id)!;
      const parentId = n.parentId;
      if (parentId && byId.has(parentId)) {
        byId.get(parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    const sortRec = (arr: IfrsNodeTreeDto[]) => {
      arr.sort((a, b) => {
        const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (so !== 0) return so;
        return a.name.localeCompare(b.name);
      });
      for (const c of arr) sortRec(c.children);
    };
    sortRec(roots);

    return roots;
  }

  private async assertCoaStructureNotFrozen(params: {
    tenantId: string;
    userId: string;
    permissionUsed: string;
    action: string;
    reason?: Record<string, any>;
  }) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { coaStructureFrozen: true } as any,
    });

    const frozen = Boolean((t as any)?.coaStructureFrozen);
    if (!frozen) return;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: params.tenantId,
          eventType: 'COA_STRUCTURE_CHANGE_BLOCKED' as any,
          entityType: 'TENANT' as any,
          entityId: params.tenantId,
          action: params.action,
          outcome: 'BLOCKED' as any,
          reason: params.reason ? JSON.stringify(params.reason) : undefined,
          userId: params.userId,
          permissionUsed: params.permissionUsed as any,
        } as any,
      })
      .catch(() => undefined);

    throw new ForbiddenException(
      'COA structure is frozen. Submit a controlled change request to modify structure.',
    );
  }

  async listTree(req: Request, params?: { includeInactive?: boolean }) {
    const { tenant } = this.assertTenant(req);

    const includeInactive = params?.includeInactive === true;

    const rows = await (this.prisma as any).ifrsNode.findMany({
      where: {
        tenantId: tenant.id,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ statement: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        statement: true,
        parentId: true,
        level: true,
        sortOrder: true,
        isActive: true,
      },
    });

    const nodes = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      statement: r.statement as IfrsStatementDto,
      parentId: r.parentId ?? null,
      level: r.level ?? null,
      sortOrder: r.sortOrder ?? 0,
      isActive: r.isActive,
    }));

    const byStatement: Record<string, IfrsNodeDto[]> = { BS: [], PL: [], CF: [] };
    for (const n of nodes) {
      byStatement[String(n.statement)] = byStatement[String(n.statement)] ?? [];
      byStatement[String(n.statement)].push(n);
    }

    return {
      BS: this.buildTree(byStatement.BS ?? []),
      PL: this.buildTree(byStatement.PL ?? []),
      CF: this.buildTree(byStatement.CF ?? []),
    } as Record<IfrsStatementDto, IfrsNodeTreeDto[]>;
  }

  async listFlatReference(req: Request, params?: { includeInactive?: boolean }) {
    const trees = await this.listTree(req, params);

    const out: IfrsNodeFlatRefDto[] = [];
    const walk = (statement: IfrsStatementDto, node: IfrsNodeTreeDto, prefix: string[]) => {
      const nextPrefix = [...prefix, node.name];
      out.push({
        id: node.id,
        name: node.name,
        statement,
        code: node.code,
        fullPath: nextPrefix.join(' > '),
        parentId: node.parentId ?? null,
        level: node.level ?? null,
      });
      for (const c of node.children) walk(statement, c, nextPrefix);
    };

    (Object.keys(trees) as IfrsStatementDto[]).forEach((statement) => {
      for (const root of trees[statement] ?? []) {
        walk(statement, root, [statement]);
      }
    });

    return out;
  }

  private async assertParentValid(params: {
    tenantId: string;
    parentId: string;
    statement: IfrsStatementDto;
    selfId?: string;
  }) {
    const parent = await (this.prisma as any).ifrsNode.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.parentId,
        isActive: true,
      },
      select: { id: true, statement: true, parentId: true },
    });
    if (!parent) throw new BadRequestException('Parent IFRS node not found');
    if (parent.statement !== params.statement) {
      throw new BadRequestException('Parent IFRS node must be in the same statement');
    }

    // Prevent trivial self-parenting + cycles by walking up.
    if (params.selfId && parent.id === params.selfId) {
      throw new BadRequestException('A node cannot be its own parent');
    }

    if (params.selfId) {
      let cur: string | null = parent.parentId ?? null;
      const visited = new Set<string>();
      while (cur) {
        if (visited.has(cur)) break;
        visited.add(cur);
        if (cur === params.selfId) {
          throw new BadRequestException('Circular IFRS hierarchy is not allowed');
        }
        const next = await (this.prisma as any).ifrsNode.findFirst({
          where: { tenantId: params.tenantId, id: cur },
          select: { parentId: true },
        });
        cur = next?.parentId ?? null;
      }
    }
  }

  async create(req: Request, dto: CreateIfrsNodeDto) {
    const { tenant, user } = this.assertTenant(req);

    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.FINANCE.CONFIG_CHANGE,
      action: 'IFRS_NODE_CREATE',
      reason: {
        action: 'IFRS_NODE_CREATE',
        statement: dto.statement,
        parentId: dto.parentId ?? null,
        code: dto.code ?? null,
        name: dto.name ?? null,
      },
    });

    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');

    const codeRaw = String(dto.code ?? '').trim();
    if (!codeRaw) throw new BadRequestException('code is required');
    const code = codeRaw;

    const statement = dto.statement;
    if (!statement) throw new BadRequestException('statement is required');

    const parentId = dto.parentId ? String(dto.parentId).trim() : null;
    if (parentId) {
      await this.assertParentValid({ tenantId: tenant.id, parentId, statement });
    }

    const sortOrder = dto.sortOrder ?? 0;

    try {
      const created = await (this.prisma as any).ifrsNode.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          statement,
          parentId,
          sortOrder,
          isActive: true,
          createdById: user.id,
        },
        select: {
          id: true,
          code: true,
          name: true,
          statement: true,
          parentId: true,
          level: true,
          sortOrder: true,
          isActive: true,
        },
      });

      return created;
    } catch (e: any) {
      const codeErr = String(e?.code ?? '');
      if (codeErr === 'P2002') {
        throw new ConflictException('An IFRS node with the same code or name already exists');
      }
      throw e;
    }
  }

  async update(req: Request, id: string, dto: UpdateIfrsNodeDto) {
    const { tenant, user } = this.assertTenant(req);
    if (!id) throw new BadRequestException('Missing id');

    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.FINANCE.CONFIG_CHANGE,
      action: 'IFRS_NODE_UPDATE',
      reason: {
        action: 'IFRS_NODE_UPDATE',
        ifrsNodeId: id,
        patch: dto,
      },
    });

    const existing = await (this.prisma as any).ifrsNode.findFirst({
      where: { tenantId: tenant.id, id },
      select: { id: true, statement: true },
    });
    if (!existing) throw new NotFoundException('IFRS node not found');

    const patch: any = {};

    if (dto.name !== undefined) {
      const name = String(dto.name ?? '').trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      patch.name = name;
    }

    if (dto.code !== undefined) {
      const codeRaw = String(dto.code ?? '').trim();
      if (!codeRaw) throw new BadRequestException('code cannot be empty');
      patch.code = codeRaw;
    }

    if (dto.sortOrder !== undefined) {
      patch.sortOrder = dto.sortOrder ?? 0;
    }

    if (dto.parentId !== undefined) {
      const parentId = dto.parentId ? String(dto.parentId).trim() : null;
      if (parentId) {
        await this.assertParentValid({
          tenantId: tenant.id,
          parentId,
          statement: existing.statement as IfrsStatementDto,
          selfId: id,
        });
      }
      patch.parentId = parentId;
    }

    try {
      return await (this.prisma as any).ifrsNode.update({
        where: { id },
        data: patch,
        select: {
          id: true,
          code: true,
          name: true,
          statement: true,
          parentId: true,
          level: true,
          sortOrder: true,
          isActive: true,
        },
      });
    } catch (e: any) {
      const codeErr = String(e?.code ?? '');
      if (codeErr === 'P2002') {
        throw new ConflictException('An IFRS node with the same code or name already exists');
      }
      throw e;
    }
  }

  async deactivate(req: Request, id: string) {
    const { tenant, user } = this.assertTenant(req);
    if (!id) throw new BadRequestException('Missing id');

    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.FINANCE.CONFIG_CHANGE,
      action: 'IFRS_NODE_DEACTIVATE',
      reason: {
        action: 'IFRS_NODE_DEACTIVATE',
        ifrsNodeId: id,
      },
    });

    const existing = await (this.prisma as any).ifrsNode.findFirst({
      where: { tenantId: tenant.id, id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('IFRS node not found');

    const activeChildren = await (this.prisma as any).ifrsNode.count({
      where: { tenantId: tenant.id, parentId: id, isActive: true },
    });
    if (activeChildren > 0) {
      throw new BadRequestException('Cannot deactivate an IFRS node that has active children');
    }

    await (this.prisma as any).ifrsNode.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });

    return { ok: true };
  }
}
