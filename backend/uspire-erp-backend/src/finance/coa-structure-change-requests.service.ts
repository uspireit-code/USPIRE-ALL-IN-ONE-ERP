import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getEffectiveActorContext } from '../auth/actor-context';
import { CoaService } from './coa.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import type {
  CreateCoaStructureChangeRequestDraftDto,
  RejectCoaStructureChangeRequestDto,
  SubmitCoaStructureChangeRequestDto,
  UpdateCoaStructureChangeRequestDraftDto,
} from './coa-structure-change-requests.dto';

@Injectable()
export class CoaStructureChangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coaService: CoaService,
  ) {}

  private parseEffectiveDate(raw: any) {
    const s = String(raw ?? '').trim();
    if (!s) throw new BadRequestException('proposedState.effectiveFrom is required');
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('proposedState.effectiveFrom is invalid');
    return d;
  }

  private assertEffectiveFromNotPast(d: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    if (cmp.getTime() < today.getTime()) {
      throw new BadRequestException('effectiveFrom must be today or in the future');
    }
  }

  private normalizeChangeType(raw: any) {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) throw new BadRequestException('proposedState.changeType is required');
    if (v !== 'HIERARCHY_RECLASSIFICATION' && v !== 'IFRS_RECLASSIFICATION') {
      throw new BadRequestException('proposedState.changeType is invalid');
    }
    return v;
  }

  private ensureTenant(req: Request) {
    const tenant = (req as any).tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return tenant;
  }

  private ensureUser(req: Request) {
    const user = (req as any).user;
    if (!user) throw new BadRequestException('Missing user context');
    return user;
  }

  private async assertParentValid(params: {
    tenantId: string;
    parentAccountId: string;
  }) {
    const parent = await this.prisma.account.findFirst({
      where: { tenantId: params.tenantId, id: params.parentAccountId },
      select: { id: true, isPosting: true, status: true, isActive: true },
    });
    if (!parent) throw new BadRequestException('Parent account not found');
    if (parent.status === ('RETIRED' as any)) {
      throw new BadRequestException('Parent account is retired');
    }
    if (!parent.isActive) {
      throw new BadRequestException('Parent account is inactive');
    }
    if (parent.isPosting) {
      throw new BadRequestException('Parent account must be a grouping node');
    }
  }

  private async assertNoCircularReference(params: {
    tenantId: string;
    accountId: string;
    parentAccountId: string;
  }) {
    if (params.parentAccountId === params.accountId) {
      throw new BadRequestException('Account cannot be its own parent');
    }

    let cursor: string | null = params.parentAccountId;
    const seen = new Set<string>();

    while (cursor) {
      if (seen.has(cursor)) {
        throw new BadRequestException('Circular account hierarchy detected');
      }
      seen.add(cursor);
      if (cursor === params.accountId) {
        throw new BadRequestException('Circular account hierarchy detected');
      }

      const next = await this.prisma.account.findFirst({
        where: { tenantId: params.tenantId, id: cursor },
        select: { parentAccountId: true },
      });
      if (!next) {
        throw new BadRequestException('Parent account not found');
      }
      cursor = next.parentAccountId;
    }
  }

  private async computeHierarchyPath(params: {
    tenantId: string;
    accountId: string;
    parentAccountId: string | null;
  }) {
    if (!params.parentAccountId) return params.accountId;
    const parent = await this.prisma.account.findFirst({
      where: { tenantId: params.tenantId, id: params.parentAccountId },
      select: { hierarchyPath: true },
    });
    if (!parent) throw new BadRequestException('Parent account not found');
    const prefix = parent.hierarchyPath?.trim() || params.parentAccountId;
    return `${prefix}/${params.accountId}`;
  }

  private async rebuildHierarchyPaths(params: {
    tenantId: string;
    rootAccountId: string;
    newRootPath: string;
  }) {
    const rows = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId },
      select: { id: true, parentAccountId: true },
    });

    const childrenById = new Map<string, string[]>();
    for (const r of rows) {
      if (r.parentAccountId) {
        const list = childrenById.get(r.parentAccountId) ?? [];
        list.push(r.id);
        childrenById.set(r.parentAccountId, list);
      }
    }

    const updates: Array<{ id: string; hierarchyPath: string }> = [];
    const walk = (id: string, path: string) => {
      updates.push({ id, hierarchyPath: path });
      const kids = childrenById.get(id) ?? [];
      for (const c of kids) walk(c, `${path}/${c}`);
    };

    walk(params.rootAccountId, params.newRootPath);

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.account.updateMany({
          where: { tenantId: params.tenantId, id: u.id },
          data: { hierarchyPath: u.hierarchyPath },
        }),
      ),
    );

    return { updatedNodeCount: updates.length };
  }

  async list(req: Request, query?: { status?: string }) {
    const tenant = this.ensureTenant(req);

    const status = String(query?.status ?? '').trim() || undefined;

    return (this.prisma as any).coaStructureChangeRequest.findMany({
      where: {
        tenantId: tenant.id,
        ...(status ? { status } : {}),
      } as any,
      orderBy: [{ requestedAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        requestType: true,
        description: true,
        status: true,
        requestedById: true,
        requestedAt: true,
        submittedAt: true,
        approvedById: true,
        approvedAt: true,
        rejectedById: true,
        rejectedAt: true,
        rejectionReason: true,
        implementedById: true,
        implementedAt: true,
      } as any,
    });
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const row = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { attachments: true } as any,
    });

    if (!row) throw new NotFoundException('Structure change request not found');
    return row;
  }

  async createDraft(req: Request, dto: CreateCoaStructureChangeRequestDraftDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const created = await (this.prisma as any).coaStructureChangeRequest.create({
      data: {
        tenantId: tenant.id,
        requestType: dto.requestType,
        description: dto.description,
        beforeState: dto.beforeState,
        proposedState: dto.proposedState,
        status: 'DRAFT',
        requestedById: actorCtx.realUserId,
      } as any,
      select: { id: true } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_CHANGE_REQUEST_CREATED' as any,
          entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
          entityId: created.id,
          action: 'COA_STRUCTURE_CHANGE_REQUEST_CREATE',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            requestType: dto.requestType,
            description: dto.description,
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.DRAFT_CREATE,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, created.id);
  }

  async updateDraft(req: Request, id: string, dto: UpdateCoaStructureChangeRequestDraftDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const existing = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      select: { id: true, status: true, requestedById: true } as any,
    });
    if (!existing) throw new NotFoundException('Structure change request not found');

    if (String(existing.status) !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT requests can be edited');
    }

    if (String(existing.requestedById) !== actorCtx.realUserId) {
      throw new ForbiddenException('Only the requester can edit this draft');
    }

    await (this.prisma as any).coaStructureChangeRequest.update({
      where: { id } as any,
      data: {
        ...(dto.requestType !== undefined ? { requestType: dto.requestType } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.beforeState !== undefined ? { beforeState: dto.beforeState } : {}),
        ...(dto.proposedState !== undefined ? { proposedState: dto.proposedState } : {}),
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_CHANGE_REQUEST_CREATED' as any,
          entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
          entityId: id,
          action: 'COA_STRUCTURE_CHANGE_REQUEST_EDIT_DRAFT',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            patch: dto,
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.DRAFT_EDIT,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, id);
  }

  async submit(req: Request, id: string, dto?: SubmitCoaStructureChangeRequestDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const existing = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      select: {
        id: true,
        status: true,
        requestedById: true,
      } as any,
    });
    if (!existing) throw new NotFoundException('Structure change request not found');

    if (String(existing.status) !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT requests can be submitted');
    }

    if (String(existing.requestedById) !== actorCtx.realUserId) {
      throw new ForbiddenException('Only the requester can submit this draft');
    }

    const now = new Date();

    await (this.prisma as any).coaStructureChangeRequest.update({
      where: { id } as any,
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_CHANGE_REQUEST_SUBMITTED' as any,
          entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
          entityId: id,
          action: 'COA_STRUCTURE_CHANGE_REQUEST_SUBMIT',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            comment: dto?.comment ?? null,
            submittedAt: now.toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.DRAFT_SUBMIT,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, id);
  }

  async approve(req: Request, id: string, dto?: { comment?: string }) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const existing = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      select: {
        id: true,
        status: true,
        requestedById: true,
      } as any,
    });
    if (!existing) throw new NotFoundException('Structure change request not found');

    if (String(existing.status) !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED requests can be approved');
    }

    if (String(existing.requestedById) === actorCtx.realUserId) {
      throw new ForbiddenException('Maker-checker rule: requester cannot approve');
    }

    const now = new Date();

    await (this.prisma as any).coaStructureChangeRequest.update({
      where: { id } as any,
      data: {
        status: 'APPROVED',
        approvedById: actorCtx.realUserId,
        approvedAt: now,
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_CHANGE_REQUEST_APPROVED' as any,
          entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
          entityId: id,
          action: 'COA_STRUCTURE_CHANGE_REQUEST_APPROVE',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            comment: dto?.comment ?? null,
            approvedAt: now.toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.APPROVE,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, id);
  }

  async reject(req: Request, id: string, dto: RejectCoaStructureChangeRequestDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const existing = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      select: {
        id: true,
        status: true,
        requestedById: true,
      } as any,
    });
    if (!existing) throw new NotFoundException('Structure change request not found');

    if (String(existing.status) !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED requests can be rejected');
    }

    if (String(existing.requestedById) === actorCtx.realUserId) {
      throw new ForbiddenException('Maker-checker rule: requester cannot reject');
    }

    const now = new Date();

    await (this.prisma as any).coaStructureChangeRequest.update({
      where: { id } as any,
      data: {
        status: 'REJECTED',
        rejectedById: actorCtx.realUserId,
        rejectedAt: now,
        rejectionReason: dto.rejectionReason,
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_CHANGE_REQUEST_REJECTED' as any,
          entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
          entityId: id,
          action: 'COA_STRUCTURE_CHANGE_REQUEST_REJECT',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            rejectionReason: dto.rejectionReason,
            rejectedAt: now.toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.REJECT,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, id);
  }

  async implement(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const actorCtx = getEffectiveActorContext(req);

    const request = await (this.prisma as any).coaStructureChangeRequest.findFirst({
      where: { id, tenantId: tenant.id } as any,
      select: {
        id: true,
        tenantId: true,
        requestType: true,
        status: true,
        proposedState: true,
        requestedById: true,
        implementedAt: true,
      } as any,
    });

    if (!request) throw new NotFoundException('Structure change request not found');

    if (String(request.status) === 'IMPLEMENTED') {
      throw new BadRequestException('Change request is already implemented');
    }

    if (String(request.status) !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED requests can be implemented');
    }

    if (String(request.requestedById) === actorCtx.realUserId) {
      throw new ForbiddenException('Maker-checker rule: requester cannot implement');
    }

    const requestType = String((request as any).requestType);

    if (requestType === 'HIERARCHY_CHANGE') {
      const proposedState: any = (request as any).proposedState ?? {};
      const accountId = String(proposedState.accountId ?? '').trim();
      const newParentIdRaw = proposedState.newParentId;
      const newParentId =
        newParentIdRaw === null || newParentIdRaw === undefined
          ? null
          : String(newParentIdRaw).trim() || null;

      if (!accountId) throw new BadRequestException('proposedState.accountId is required');
      if (!newParentId) throw new BadRequestException('proposedState.newParentId is required');

      const account = await this.prisma.account.findFirst({
        where: { tenantId: tenant.id, id: accountId },
        select: {
          id: true,
          status: true,
          parentAccountId: true,
        },
      });
      if (!account) throw new BadRequestException('Account not found');
      if (account.status === ('RETIRED' as any)) {
        throw new BadRequestException('Account is retired');
      }

      const oldParentId = account.parentAccountId ?? null;

      await this.assertParentValid({ tenantId: tenant.id, parentAccountId: newParentId });
      await this.assertNoCircularReference({
        tenantId: tenant.id,
        accountId,
        parentAccountId: newParentId,
      });

      const now = new Date();

      const { updatedNodeCount } = await this.prisma.$transaction(async (tx) => {
        const parentUpdate = await tx.account.updateMany({
          where: { id: accountId, tenantId: tenant.id },
          data: { parentAccountId: newParentId },
        });
        if (parentUpdate.count !== 1) {
          throw new BadRequestException('Account not found');
        }

        const newRootPath = await this.computeHierarchyPath({
          tenantId: tenant.id,
          accountId,
          parentAccountId: newParentId,
        });

        const res = await this.rebuildHierarchyPaths({
          tenantId: tenant.id,
          rootAccountId: accountId,
          newRootPath,
        });

        await (tx as any).coaStructureChangeRequest.update({
          where: { id } as any,
          data: {
            status: 'IMPLEMENTED',
            implementedById: actorCtx.realUserId,
            implementedAt: now,
          } as any,
        });

        await tx.auditEvent
          .create({
            data: {
              tenantId: tenant.id,
              eventType: 'COA_STRUCTURE_CHANGE_REQUEST_IMPLEMENTED' as any,
              entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
              entityId: id,
              action: 'COA_STRUCTURE_CHANGE_REQUEST_IMPLEMENT',
              outcome: 'SUCCESS' as any,
              reason: JSON.stringify({
                requestType: 'HIERARCHY_CHANGE',
                accountId,
                oldParentId,
                newParentId,
                affectedDescendants: Math.max(0, res.updatedNodeCount - 1),
                implementedAt: now.toISOString(),
              }),
              userId: user.id,
              permissionUsed: PERMISSIONS.COA.APPROVE,
            } as any,
          })
          .catch(() => undefined);

        return res;
      });

      return {
        ...(await this.getById(req, id)),
        implementationSummary: {
          accountId,
          oldParentId,
          newParentId,
          affectedDescendants: Math.max(0, updatedNodeCount - 1),
        },
      };
    }

    if (requestType === 'ADD_ACCOUNT') {
      const proposedState: any = (request as any).proposedState ?? {};
      const code = String(proposedState.code ?? '').trim();
      const name = String(proposedState.name ?? '').trim();
      const accountType = String(proposedState.accountType ?? '').trim();
      const parentIdRaw = proposedState.parentId;
      const parentAccountId =
        parentIdRaw === null || parentIdRaw === undefined
          ? null
          : String(parentIdRaw).trim() || null;
      const ifrsNodeIdRaw = proposedState.ifrsNodeId;
      const ifrsNodeId =
        ifrsNodeIdRaw === null || ifrsNodeIdRaw === undefined
          ? undefined
          : String(ifrsNodeIdRaw).trim() || undefined;

      if (!code) throw new BadRequestException('proposedState.code is required');
      if (!name) throw new BadRequestException('proposedState.name is required');
      if (!accountType) throw new BadRequestException('proposedState.accountType is required');
      if (!parentAccountId) throw new BadRequestException('proposedState.parentId is required');

      const created = await this.coaService.create(
        req,
        {
          code,
          name,
          accountType: accountType as any,
          parentAccountId,
          ifrsNodeId,
        } as any,
        { bypassStructureFreeze: true },
      );

      const newAccountId = String((created as any)?.id ?? '').trim();
      if (!newAccountId) {
        throw new BadRequestException('Failed to create account');
      }

      const now = new Date();

      await (this.prisma as any).coaStructureChangeRequest.update({
        where: { id } as any,
        data: {
          status: 'IMPLEMENTED',
          implementedById: actorCtx.realUserId,
          implementedAt: now,
        } as any,
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_STRUCTURE_CHANGE_REQUEST_IMPLEMENTED' as any,
            entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
            entityId: id,
            action: 'COA_STRUCTURE_CHANGE_REQUEST_IMPLEMENT',
            outcome: 'SUCCESS' as any,
            reason: JSON.stringify({
              requestType: 'ADD_ACCOUNT',
              accountId: newAccountId,
              code,
              name,
              parentId: parentAccountId,
              implementedAt: now.toISOString(),
            }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.APPROVE,
          } as any,
        })
        .catch(() => undefined);

      return {
        ...(await this.getById(req, id)),
        implementationSummary: {
          accountId: newAccountId,
          code,
          name,
          parentId: parentAccountId,
        },
      };
    }

    if (requestType === 'EFFECTIVE_DATED_RECLASSIFICATION') {
      const proposedState: any = (request as any).proposedState ?? {};

      const accountId = String(proposedState.accountId ?? '').trim();
      if (!accountId) throw new BadRequestException('proposedState.accountId is required');

      const changeType = this.normalizeChangeType(proposedState.changeType);
      const effectiveFrom = this.parseEffectiveDate(proposedState.effectiveFrom);
      this.assertEffectiveFromNotPast(effectiveFrom);

      const effectiveToRaw = proposedState.effectiveTo;
      const effectiveTo =
        effectiveToRaw === null || effectiveToRaw === undefined || String(effectiveToRaw).trim() === ''
          ? null
          : this.parseEffectiveDate(effectiveToRaw);
      if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
        throw new BadRequestException('proposedState.effectiveTo must be >= effectiveFrom');
      }

      const reason = String(proposedState.reason ?? '').trim();
      if (!reason) throw new BadRequestException('proposedState.reason is required');

      const newParentAccountIdRaw = proposedState.newParentAccountId;
      const newParentAccountId =
        newParentAccountIdRaw === null || newParentAccountIdRaw === undefined
          ? null
          : String(newParentAccountIdRaw).trim() || null;

      const newIfrsNodeIdRaw = proposedState.newIfrsNodeId;
      const newIfrsNodeId =
        newIfrsNodeIdRaw === null || newIfrsNodeIdRaw === undefined
          ? null
          : String(newIfrsNodeIdRaw).trim() || null;

      if (changeType === 'HIERARCHY_RECLASSIFICATION') {
        if (!newParentAccountId) {
          throw new BadRequestException('proposedState.newParentAccountId is required');
        }
      }
      if (changeType === 'IFRS_RECLASSIFICATION') {
        if (!newIfrsNodeId) {
          throw new BadRequestException('proposedState.newIfrsNodeId is required');
        }
      }

      const account = await this.prisma.account.findFirst({
        where: { tenantId: tenant.id, id: accountId },
        select: {
          id: true,
          status: true,
          parentAccountId: true,
          ifrsNodeId: true,
          type: true,
        },
      });
      if (!account) throw new BadRequestException('Account not found');
      if (account.status === ('RETIRED' as any)) {
        throw new BadRequestException('Account is retired');
      }

      const now = new Date();
      const oldParentAccountId = account.parentAccountId ?? null;
      const oldIfrsNodeId = (account as any).ifrsNodeId ?? null;

      if (changeType === 'HIERARCHY_RECLASSIFICATION') {
        await this.assertParentValid({ tenantId: tenant.id, parentAccountId: newParentAccountId! });
        await this.assertNoCircularReference({
          tenantId: tenant.id,
          accountId,
          parentAccountId: newParentAccountId!,
        });
      }

      if (changeType === 'IFRS_RECLASSIFICATION') {
        const node = await (this.prisma as any).ifrsNode.findFirst({
          where: { tenantId: tenant.id, id: newIfrsNodeId, isActive: true } as any,
          select: { id: true } as any,
        });
        if (!node) throw new BadRequestException('IFRS node not found');
      }

      // Overlap rule: reject any existing active window that overlaps [effectiveFrom..effectiveTo]
      // Treat null effectiveTo as open-ended.
      const overlap = await (this.prisma as any).coaStructuralChange.findFirst({
        where: {
          tenantId: tenant.id,
          accountId,
          changeType,
          isActive: true,
          AND: [
            // existing.effectiveFrom <= newEnd (or always true if newEnd is null)
            ...(effectiveTo ? [{ effectiveFrom: { lte: effectiveTo } }] : []),
            // existingEnd >= newStart (where null end means infinity)
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] },
          ],
        } as any,
        select: { id: true } as any,
      });
      if (overlap) {
        throw new BadRequestException('An active structural change already exists for this account and type');
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const row = await (tx as any).coaStructuralChange.create({
          data: {
            tenantId: tenant.id,
            accountId,
            changeType,
            oldParentAccountId,
            newParentAccountId,
            oldIfrsNodeId,
            newIfrsNodeId,
            effectiveFrom,
            effectiveTo,
            reason,
            sourceChangeRequestId: id,
            approvedByUserId: String((request as any).approvedById ?? actorCtx.realUserId),
            approvedAt: (request as any).approvedAt ?? now,
            implementedByUserId: actorCtx.realUserId,
            implementedAt: now,
            isActive: true,
          } as any,
          select: { id: true } as any,
        });

        await (tx as any).coaStructureChangeRequest.update({
          where: { id } as any,
          data: {
            status: 'IMPLEMENTED',
            implementedById: actorCtx.realUserId,
            implementedAt: now,
          } as any,
        });

        await tx.auditEvent
          .create({
            data: {
              tenantId: tenant.id,
              eventType: 'COA_STRUCTURE_RECLASSIFICATION_CREATED' as any,
              entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
              entityId: id,
              action: 'COA_STRUCTURE_RECLASSIFICATION_CREATE',
              outcome: 'SUCCESS' as any,
              reason: JSON.stringify({
                changeType,
                accountId,
                oldParentAccountId,
                newParentAccountId,
                oldIfrsNodeId,
                newIfrsNodeId,
                effectiveFrom: effectiveFrom.toISOString(),
                sourceChangeRequestId: id,
              }),
              userId: user.id,
              permissionUsed: PERMISSIONS.COA.APPROVE,
            } as any,
          })
          .catch(() => undefined);

        await tx.auditEvent
          .create({
            data: {
              tenantId: tenant.id,
              eventType: 'COA_STRUCTURE_RECLASSIFICATION_IMPLEMENTED' as any,
              entityType: 'COA_STRUCTURE_CHANGE_REQUEST' as any,
              entityId: id,
              action: 'COA_STRUCTURE_RECLASSIFICATION_IMPLEMENT',
              outcome: 'SUCCESS' as any,
              reason: JSON.stringify({
                changeType,
                accountId,
                oldParentAccountId,
                newParentAccountId,
                oldIfrsNodeId,
                newIfrsNodeId,
                effectiveFrom: effectiveFrom.toISOString(),
                implementedAt: now.toISOString(),
                sourceChangeRequestId: id,
              }),
              userId: user.id,
              permissionUsed: PERMISSIONS.COA.APPROVE,
            } as any,
          })
          .catch(() => undefined);

        return row;
      });

      return {
        ...(await this.getById(req, id)),
        implementationSummary: {
          structuralChangeId: created.id,
          accountId,
          changeType,
          oldParentAccountId,
          newParentAccountId,
          oldIfrsNodeId,
          newIfrsNodeId,
          effectiveFrom: effectiveFrom.toISOString(),
        },
      };
    }

    throw new BadRequestException('Unsupported requestType for implementation');
  }
}
