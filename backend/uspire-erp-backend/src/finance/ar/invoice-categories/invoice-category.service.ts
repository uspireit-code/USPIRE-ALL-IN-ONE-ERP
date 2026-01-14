import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { PERMISSIONS } from '../../../rbac/permission-catalog';
import type {
  CreateInvoiceCategoryDto,
  UpdateInvoiceCategoryDto,
} from './invoice-categories.dto';

@Injectable()
export class InvoiceCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureTenant(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return tenant;
  }

  private ensureUser(req: Request) {
    const user = req.user;
    if (!user) throw new BadRequestException('Missing user context');
    return user;
  }

  private async assertRevenueAccountValid(params: {
    tenantId: string;
    revenueAccountId: string;
  }) {
    const acct = await this.prisma.account.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.revenueAccountId,
        isActive: true,
        type: 'INCOME' as any,
      } as any,
      select: { id: true } as any,
    } as any);

    if (!acct) {
      throw new BadRequestException(
        'Revenue account must exist, be ACTIVE, and be of type INCOME',
      );
    }
  }

  async list(req: Request) {
    const tenant = this.ensureTenant(req);

    const items = await (this.prisma as any).invoiceCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        isActive: true,
        isSystemDefault: true,
        revenueAccountId: true,
        revenueAccount: { select: { id: true, code: true, name: true } },
        requiresProject: true,
        requiresFund: true,
        requiresDepartment: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    return { items };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const item = await (this.prisma as any).invoiceCategory.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        isActive: true,
        isSystemDefault: true,
        revenueAccountId: true,
        revenueAccount: { select: { id: true, code: true, name: true } },
        requiresProject: true,
        requiresFund: true,
        requiresDepartment: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    });

    if (!item) throw new NotFoundException('Invoice category not found');
    return item;
  }

  async create(req: Request, dto: CreateInvoiceCategoryDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const code = String(dto.code ?? '').trim();
    const name = String(dto.name ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');

    const revenueAccountId = String(dto.revenueAccountId ?? '').trim();
    if (!revenueAccountId)
      throw new BadRequestException('revenueAccountId is required');

    await this.assertRevenueAccountValid({
      tenantId: tenant.id,
      revenueAccountId,
    });

    try {
      const created = await (this.prisma as any).invoiceCategory.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          isActive: true,
          revenueAccountId,
          requiresProject: Boolean(dto.requiresProject),
          requiresFund: Boolean(dto.requiresFund),
          requiresDepartment: Boolean(dto.requiresDepartment),
        } as any,
        select: { id: true } as any,
      });

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_CONFIG',
            entityType: 'INVOICE_CATEGORY',
            entityId: created.id,
            action: 'INVOICE_CATEGORY_CREATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: PERMISSIONS.AR.INVOICE_CATEGORY_CREATE,
          } as any,
        })
        .catch(() => undefined);

      return this.getById(req, created.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Invoice category code must be unique');
      }

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_CONFIG',
            entityType: 'INVOICE_CATEGORY',
            entityId: '',
            action: 'INVOICE_CATEGORY_CREATE',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to create invoice category'),
            userId: user.id,
            permissionUsed: PERMISSIONS.AR.INVOICE_CATEGORY_CREATE,
          } as any,
        })
        .catch(() => undefined);

      throw e;
    }
  }

  async update(req: Request, id: string, dto: UpdateInvoiceCategoryDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await (this.prisma as any).invoiceCategory.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true } as any,
    });
    if (!existing) throw new NotFoundException('Invoice category not found');

    const code = dto.code !== undefined ? String(dto.code ?? '').trim() : undefined;
    const name = dto.name !== undefined ? String(dto.name ?? '').trim() : undefined;
    if (code !== undefined && !code)
      throw new BadRequestException('code must not be empty');
    if (name !== undefined && !name)
      throw new BadRequestException('name must not be empty');

    const revenueAccountId =
      dto.revenueAccountId !== undefined
        ? String(dto.revenueAccountId ?? '').trim()
        : undefined;
    if (dto.revenueAccountId !== undefined && !revenueAccountId) {
      throw new BadRequestException('revenueAccountId must not be empty');
    }

    if (revenueAccountId) {
      await this.assertRevenueAccountValid({
        tenantId: tenant.id,
        revenueAccountId,
      });
    }

    try {
      const updated = await (this.prisma as any).invoiceCategory.update({
        where: { id },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(revenueAccountId !== undefined
            ? { revenueAccountId }
            : {}),
          ...(dto.requiresProject !== undefined
            ? { requiresProject: Boolean(dto.requiresProject) }
            : {}),
          ...(dto.requiresFund !== undefined
            ? { requiresFund: Boolean(dto.requiresFund) }
            : {}),
          ...(dto.requiresDepartment !== undefined
            ? { requiresDepartment: Boolean(dto.requiresDepartment) }
            : {}),
        } as any,
        select: { id: true } as any,
      });

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_CONFIG',
            entityType: 'INVOICE_CATEGORY',
            entityId: updated.id,
            action: 'INVOICE_CATEGORY_UPDATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE,
          } as any,
        })
        .catch(() => undefined);

      return this.getById(req, updated.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Invoice category code must be unique');
      }

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_CONFIG',
            entityType: 'INVOICE_CATEGORY',
            entityId: id,
            action: 'INVOICE_CATEGORY_UPDATE',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to update invoice category'),
            userId: user.id,
            permissionUsed: PERMISSIONS.AR.INVOICE_CATEGORY_UPDATE,
          } as any,
        })
        .catch(() => undefined);

      throw e;
    }
  }

  async setActive(req: Request, id: string, isActive: boolean) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('isActive must be a boolean');
    }

    const existing = await (this.prisma as any).invoiceCategory.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, isActive: true } as any,
    });
    if (!existing) throw new NotFoundException('Invoice category not found');

    const updated = await (this.prisma as any).invoiceCategory.update({
      where: { id },
      data: {
        isActive,
      } as any,
      select: { id: true } as any,
    });

    await (this.prisma as any).auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'AR_CONFIG',
          entityType: 'INVOICE_CATEGORY',
          entityId: id,
          action: 'INVOICE_CATEGORY_DISABLE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: PERMISSIONS.AR.INVOICE_CATEGORY_DISABLE,
        } as any,
      })
      .catch(() => undefined);

    return this.getById(req, updated.id);
  }
}
