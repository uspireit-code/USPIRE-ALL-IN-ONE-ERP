import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PeriodCloseService {
  constructor(private readonly prisma: PrismaService) {}

  async getChecklist(req: Request, periodId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: tenant.id },
      select: { id: true, name: true, status: true },
    });

    if (!period) throw new NotFoundException('Accounting period not found');

    const checklist = await this.prisma.periodCloseChecklist.findFirst({
      where: { tenantId: tenant.id, periodId: period.id },
      select: {
        id: true,
        periodId: true,
        createdAt: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            completedAt: true,
            completedBy: { select: { id: true, email: true } },
            createdAt: true,
          },
        },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Period close checklist not found');
    }

    return { period, checklist };
  }

  async completeItem(
    req: Request,
    params: { periodId: string; itemId: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: params.periodId, tenantId: tenant.id },
      select: { id: true, status: true, name: true },
    });

    if (!period) throw new NotFoundException('Accounting period not found');

    if (period.status !== 'OPEN') {
      throw new ForbiddenException({
        error: 'Checklist completion blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    const item = await this.prisma.periodCloseChecklistItem.findFirst({
      where: {
        id: params.itemId,
        tenantId: tenant.id,
        checklist: {
          tenantId: tenant.id,
          periodId: period.id,
        },
      },
      select: { id: true, status: true },
    });

    if (!item) throw new NotFoundException('Checklist item not found');

    if (item.status === 'COMPLETED') {
      throw new BadRequestException('Checklist item is already completed');
    }

    return this.prisma.periodCloseChecklistItem.update({
      where: { id: item.id },
      data: {
        status: 'COMPLETED',
        completedById: user.id,
        completedAt: new Date(),
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        completedAt: true,
        completedBy: { select: { id: true, email: true } },
        createdAt: true,
      },
    });
  }
}
