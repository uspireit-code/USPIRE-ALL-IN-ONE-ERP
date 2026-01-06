import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
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
    return this.prisma.project.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isRestricted: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
  }

  async create(req: Request, dto: CreateProjectDto) {
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

    const status = ((dto.status as any) ?? 'ACTIVE') as 'ACTIVE' | 'CLOSED';
    const isActive = dto.isActive ?? (status === 'ACTIVE');

    try {
      const created = await this.prisma.project.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          status,
          isRestricted: dto.isRestricted ?? false,
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
            eventType: 'PROJECT_CREATED' as any,
            entityType: 'PROJECT' as any,
            entityId: created.id,
            action: 'MASTER_DATA_PROJECT_CREATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'MASTER_DATA_PROJECT_CREATE',
          },
        })
        .catch(() => undefined);

      return this.getById(req, created.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Project code must be unique per tenant');
      }
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'PROJECT_CREATED' as any,
            entityType: 'PROJECT' as any,
            entityId: 'UNKNOWN',
            action: 'MASTER_DATA_PROJECT_CREATE',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to create project'),
            userId: user.id,
            permissionUsed: 'MASTER_DATA_PROJECT_CREATE',
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const proj = await this.prisma.project.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isRestricted: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
    if (!proj) throw new NotFoundException('Project not found');
    return proj;
  }

  async update(req: Request, id: string, dto: UpdateProjectDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await this.prisma.project.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, isActive: true } as any,
    });
    if (!existing) throw new NotFoundException('Project not found');

    const code = dto.code !== undefined ? String(dto.code).trim() : undefined;
    const name = dto.name !== undefined ? String(dto.name).trim() : undefined;
    if (code !== undefined && !code) throw new BadRequestException('code must not be empty');
    if (name !== undefined && !name) throw new BadRequestException('name must not be empty');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    if (dto.effectiveFrom && Number.isNaN(effectiveFrom?.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }

    if (dto.effectiveTo && Number.isNaN(new Date(dto.effectiveTo).getTime())) {
      throw new BadRequestException('effectiveTo must be a valid date');
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
          projectId: id,
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
          },
        },
        select: { id: true },
      });
      if (usedByPosted) {
        throw new BadRequestException(
          'Project cannot be closed/inactivated because it is referenced by posted transactions.',
        );
      }
    }

    try {
      const updated = await this.prisma.project.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(dto.status !== undefined ? { status: dto.status as any } : {}),
          ...(dto.isRestricted !== undefined ? { isRestricted: Boolean(dto.isRestricted) } : {}),
          isActive: nextIsActive,
          ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null } : {}),
        } as any,
        select: { id: true },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'PROJECT_UPDATED' as any,
            entityType: 'PROJECT' as any,
            entityId: updated.id,
            action: 'MASTER_DATA_PROJECT_EDIT',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'MASTER_DATA_PROJECT_EDIT',
          },
        })
        .catch(() => undefined);

      return this.getById(req, updated.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Project code must be unique per tenant');
      }
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'PROJECT_UPDATED' as any,
            entityType: 'PROJECT' as any,
            entityId: String((existing as any).id ?? ''),
            action: 'MASTER_DATA_PROJECT_EDIT',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to update project'),
            userId: user.id,
            permissionUsed: 'MASTER_DATA_PROJECT_EDIT',
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  async close(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await this.prisma.project.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true } as any,
    });
    if (!existing) throw new NotFoundException('Project not found');
    if ((existing as any).status === 'CLOSED') {
      throw new BadRequestException('Project is already closed');
    }

    const usedByPosted = await (this.prisma.journalLine as any).findFirst({
      where: {
        projectId: id,
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
        },
      },
      select: { id: true },
    });
    if (usedByPosted) {
      throw new BadRequestException(
        'Project cannot be closed because it is referenced by posted transactions.',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status: 'CLOSED' as any,
        isActive: false,
      } as any,
      select: { id: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'PROJECT_CLOSED' as any,
          entityType: 'PROJECT' as any,
          entityId: updated.id,
          action: 'MASTER_DATA_PROJECT_CLOSE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'MASTER_DATA_PROJECT_CLOSE',
        },
      })
      .catch(() => undefined);

    return this.getById(req, updated.id);
  }
}
