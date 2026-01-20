import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import {
  CreateDepartmentDto,
  CreateDepartmentMemberDto,
  UpdateDepartmentDto,
  UpdateDepartmentMemberStatusDto,
} from './departments.dto';

@Injectable()
export class DepartmentsService {
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
    return this.prisma.department.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
  }

  async create(req: Request, dto: CreateDepartmentDto) {
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

    try {
      const created = await this.prisma.department.create({
        data: {
          tenantId: tenant.id,
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
            eventType: 'DEPARTMENT_CREATED' as any,
            entityType: 'DEPARTMENT' as any,
            entityId: created.id,
            action: 'MASTER_DATA_DEPARTMENT_CREATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE,
          },
        })
        .catch(() => undefined);

      return this.getById(req, created.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Department code must be unique per tenant');
      }

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'DEPARTMENT_CREATED' as any,
            entityType: 'DEPARTMENT' as any,
            entityId: 'UNKNOWN',
            action: 'MASTER_DATA_DEPARTMENT_CREATE',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to create department'),
            userId: user.id,
            permissionUsed: PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE,
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const dep = await this.prisma.department.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        isActive: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });
    if (!dep) throw new NotFoundException('Department not found');
    return dep;
  }

  async update(req: Request, id: string, dto: UpdateDepartmentDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, isActive: true } as any,
    });
    if (!existing) throw new NotFoundException('Department not found');

    const code = dto.code !== undefined ? String(dto.code).trim() : undefined;
    const name = dto.name !== undefined ? String(dto.name).trim() : undefined;
    if (code !== undefined && !code) throw new BadRequestException('code must not be empty');
    if (name !== undefined && !name) throw new BadRequestException('name must not be empty');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    if (dto.effectiveFrom && Number.isNaN(effectiveFrom?.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : dto.effectiveTo === null ? null : undefined;
    if (dto.effectiveTo && Number.isNaN((effectiveTo as any)?.getTime?.())) {
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
          departmentId: id,
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
          },
        },
        select: { id: true },
      });
      if (usedByPosted) {
        throw new BadRequestException(
          'Department cannot be inactivated because it is referenced by posted transactions.',
        );
      }
    }

    try {
      const updated = await this.prisma.department.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(dto.status !== undefined ? { status: dto.status as any } : {}),
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
            eventType: 'DEPARTMENT_UPDATED' as any,
            entityType: 'DEPARTMENT' as any,
            entityId: updated.id,
            action: 'MASTER_DATA_DEPARTMENT_EDIT',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT,
          },
        })
        .catch(() => undefined);

      return this.getById(req, updated.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Department code must be unique per tenant');
      }

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'DEPARTMENT_UPDATED' as any,
            entityType: 'DEPARTMENT' as any,
            entityId: String((existing as any).id ?? ''),
            action: 'MASTER_DATA_DEPARTMENT_EDIT',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to update department'),
            userId: user.id,
            permissionUsed: PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT,
          },
        })
        .catch(() => undefined);
      throw e;
    }
  }

  async listMembers(req: Request, departmentId: string) {
    const tenant = this.ensureTenant(req);

    const dep = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!dep) throw new NotFoundException('Department not found');

    const rows = await (this.prisma as any).departmentMembership.findMany({
      where: { tenantId: tenant.id, departmentId },
      orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        userId: true,
        status: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      } as any,
    });

    return rows;
  }

  async addMember(req: Request, departmentId: string, dto: CreateDepartmentMemberDto) {
    const tenant = this.ensureTenant(req);

    const dep = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!dep) throw new NotFoundException('Department not found');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    if (dto.effectiveFrom && Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (dto.effectiveTo && Number.isNaN(effectiveTo?.getTime())) {
      throw new BadRequestException('effectiveTo must be a valid date');
    }

    try {
      return await (this.prisma as any).departmentMembership.upsert({
        where: {
          tenantId_departmentId_userId: {
            tenantId: tenant.id,
            departmentId,
            userId: dto.userId,
          },
        },
        create: {
          tenantId: tenant.id,
          departmentId,
          userId: dto.userId,
          status: 'ACTIVE' as any,
          effectiveFrom,
          effectiveTo,
        } as any,
        update: {
          status: 'ACTIVE' as any,
          effectiveFrom,
          effectiveTo,
        } as any,
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('User is already assigned to this department');
      }
      throw e;
    }
  }

  async updateMemberStatus(
    req: Request,
    departmentId: string,
    userId: string,
    dto: UpdateDepartmentMemberStatusDto,
  ) {
    const tenant = this.ensureTenant(req);

    const dep = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!dep) throw new NotFoundException('Department not found');

    const existing = await (this.prisma as any).departmentMembership.findFirst({
      where: { tenantId: tenant.id, departmentId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Department member not found');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    if (dto.effectiveFrom && Number.isNaN(effectiveFrom?.getTime())) {
      throw new BadRequestException('effectiveFrom must be a valid date');
    }
    const effectiveTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? new Date(dto.effectiveTo)
          : null
        : undefined;
    if (dto.effectiveTo && Number.isNaN((effectiveTo as any)?.getTime?.())) {
      throw new BadRequestException('effectiveTo must be a valid date');
    }

    const status = dto.isActive ? ('ACTIVE' as any) : ('INACTIVE' as any);

    return (this.prisma as any).departmentMembership.update({
      where: { id: existing.id },
      data: {
        status,
        ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(effectiveTo !== undefined ? { effectiveTo } : {}),
      } as any,
      select: { id: true },
    });
  }
}
