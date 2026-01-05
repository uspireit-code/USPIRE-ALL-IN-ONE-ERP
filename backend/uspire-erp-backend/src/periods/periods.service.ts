import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import type { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  async listPeriods(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      // Keep error shape consistent with other services
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.accountingPeriod.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ startDate: 'asc' }],
    });
  }

  async createPeriod(req: Request, dto: CreateAccountingPeriodDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const created = await this.gl.createAccountingPeriod(req, dto);

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'PERIOD_CREATED' as any,
          entityType: 'ACCOUNTING_PERIOD',
          entityId: created.id,
          action: 'FINANCE_PERIOD_CREATE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            periodId: created.id,
            code: (created as any).code ?? null,
            name: (created as any).name ?? null,
            type: (created as any).type ?? null,
            startDate: (created as any).startDate ?? null,
            endDate: (created as any).endDate ?? null,
            status: (created as any).status ?? null,
          }),
          userId: user.id,
          permissionUsed: 'FINANCE_PERIOD_CREATE',
        },
      })
      .catch(() => undefined);

    return created;
  }

  async getChecklist(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.gl.getAccountingPeriodChecklist(req, id);
  }

  async completeChecklistItem(
    req: Request,
    params: { periodId: string; itemId: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    return this.gl.completeAccountingPeriodChecklistItem(req, params);
  }

  async closePeriod(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const before = await (this.prisma.accountingPeriod as any).findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    const beforeAny = before as any;

    const updated = await this.gl.closeAccountingPeriod(req, id);

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'PERIOD_CLOSED' as any,
          entityType: 'ACCOUNTING_PERIOD',
          entityId: id,
          action: 'FINANCE_PERIOD_CLOSE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            periodId: id,
            code: beforeAny?.code ?? null,
            type: beforeAny?.type ?? null,
            startDate: before?.startDate ?? null,
            endDate: before?.endDate ?? null,
            oldStatus: before?.status ?? null,
            newStatus: (updated as any).status ?? null,
          }),
          userId: user.id,
          permissionUsed: 'FINANCE_PERIOD_CLOSE',
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async reopenPeriod(req: Request, id: string, dto: { reason?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const before = await (this.prisma.accountingPeriod as any).findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    const beforeAny = before as any;

    const updated = await this.gl.reopenAccountingPeriod(req, id, dto);

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'PERIOD_REOPENED' as any,
          entityType: 'ACCOUNTING_PERIOD',
          entityId: id,
          action: 'FINANCE_PERIOD_REOPEN',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            periodId: id,
            reopenReason: String(dto?.reason ?? '').trim() || null,
            code: beforeAny?.code ?? null,
            type: beforeAny?.type ?? null,
            startDate: before?.startDate ?? null,
            endDate: before?.endDate ?? null,
            oldStatus: before?.status ?? null,
            newStatus: (updated as any).status ?? null,
          }),
          userId: user.id,
          permissionUsed: 'FINANCE_PERIOD_REOPEN',
        },
      })
      .catch(() => undefined);

    return updated;
  }
}
