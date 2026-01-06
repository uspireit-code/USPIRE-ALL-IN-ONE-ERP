import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFundDto, UpdateFundDto } from './funds.dto';

@Injectable()
export class FundsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureTenant(req: Request) {
    const tenant: any = (req as any).tenant;
    if (!tenant?.id) throw new BadRequestException('Missing tenant context');
    return tenant as { id: string };
  }

  private ensureUser(req: Request) {
    const user: any = (req as any).user;
    if (!user?.id) throw new BadRequestException('Missing user context');
    return user as { id: string };
  }

  async list(req: Request) {
    const tenant = this.ensureTenant(req);
    return this.prisma.fund.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        projectId: true,
        status: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
  }

  async create(req: Request, dto: CreateFundDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const code = String(dto.code ?? '').trim();
    const name = String(dto.name ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');

    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (dto.effectiveTo && Number.isNaN(effectiveTo?.getTime())) {
      throw new BadRequestException('effectiveTo must be a valid date');
    }

    const status = ((dto.status as any) ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE';
    const isActive = dto.isActive ?? (status === 'ACTIVE');

    const projectId = dto.projectId ? String(dto.projectId).trim() : undefined;
    if (dto.projectId && !projectId) {
      throw new BadRequestException('projectId must not be empty');
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { tenantId: tenant.id, id: projectId },
        select: { id: true },
      });
      if (!project) throw new BadRequestException('Project not found');
    }

    try {
      const created = await this.prisma.fund.create({
        data: {
          tenantId: tenant.id,
          projectId: projectId ?? undefined,
          code,
          name,
          status,
          isActive,
          effectiveFrom,
          effectiveTo,
          createdById: user.id,
        } as any,
        select: { id: true },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'FUND_CREATED' as any,
            entityType: 'FUND' as any,
            entityId: created.id,
            action: 'MASTER_DATA_FUND_CREATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'MASTER_DATA_FUND_CREATE',
          },
        })
        .catch(() => undefined);

      return this.getById(req, created.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Fund code must be unique per tenant');
      }
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'FUND_CREATED' as any,
            entityType: 'FUND' as any,
            entityId: 'UNKNOWN',
            action: 'MASTER_DATA_FUND_CREATE',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to create fund'),
            userId: user.id,
            permissionUsed: 'MASTER_DATA_FUND_CREATE',
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const fund = await this.prisma.fund.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        projectId: true,
        status: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
    if (!fund) throw new NotFoundException('Fund not found');
    return fund;
  }

  async update(req: Request, id: string, dto: UpdateFundDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await this.prisma.fund.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, isActive: true } as any,
    });
    if (!existing) throw new NotFoundException('Fund not found');

    const code = dto.code !== undefined ? String(dto.code).trim() : undefined;
    const name = dto.name !== undefined ? String(dto.name).trim() : undefined;
    if (code !== undefined && !code) throw new BadRequestException('code must not be empty');
    if (name !== undefined && !name) throw new BadRequestException('name must not be empty');

    if (dto.effectiveFrom && Number.isNaN(new Date(dto.effectiveFrom).getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }

    if (dto.effectiveTo && Number.isNaN(new Date(dto.effectiveTo).getTime())) {
      throw new BadRequestException('effectiveTo must be a valid date');
    }

    const projectId = dto.projectId !== undefined ? (dto.projectId ? String(dto.projectId).trim() : null) : undefined;
    if (dto.projectId && !String(dto.projectId).trim()) {
      throw new BadRequestException('projectId must not be empty');
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { tenantId: tenant.id, id: projectId },
        select: { id: true },
      });
      if (!project) throw new BadRequestException('Project not found');
    }

    const nextStatus =
      dto.status !== undefined ? (dto.status as any) : ((existing as any).status as any);
    const statusIsActive = nextStatus === 'ACTIVE';
    const nextIsActive =
      dto.isActive !== undefined
        ? Boolean(dto.isActive)
        : dto.status !== undefined
          ? statusIsActive
          : Boolean((existing as any).isActive);

    const isDeactivating = nextStatus !== 'ACTIVE' || !nextIsActive;
    if (isDeactivating) {
      const usedByPosted = await (this.prisma.journalLine as any).findFirst({
        where: {
          fundId: id,
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
          },
        },
        select: { id: true },
      });
      if (usedByPosted) {
        throw new BadRequestException(
          'Fund cannot be inactivated because it is referenced by posted transactions.',
        );
      }
    }

    try {
      const updated = await this.prisma.fund.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
          ...(dto.status !== undefined ? { status: dto.status as any } : {}),
          isActive: nextIsActive,
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom: new Date(dto.effectiveFrom) } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null } : {}),
        } as any,
        select: { id: true },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'FUND_UPDATED' as any,
            entityType: 'FUND' as any,
            entityId: updated.id,
            action: 'MASTER_DATA_FUND_EDIT',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'MASTER_DATA_FUND_EDIT',
          },
        })
        .catch(() => undefined);

      return this.getById(req, updated.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Fund code must be unique per tenant');
      }
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'FUND_UPDATED' as any,
            entityType: 'FUND' as any,
            entityId: String((existing as any).id ?? ''),
            action: 'MASTER_DATA_FUND_EDIT',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to update fund'),
            userId: user.id,
            permissionUsed: 'MASTER_DATA_FUND_EDIT',
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }
}
