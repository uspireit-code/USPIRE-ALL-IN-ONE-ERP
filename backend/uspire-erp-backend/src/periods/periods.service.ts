import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import type { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';
import type { CorrectPeriodDto } from './dto/correct-period.dto';
import {
  buildOverlapPeriodFieldError,
  parseStrictIsoDate,
  throwPeriodValidation,
  validateMonthlyPeriodDates,
} from './period-validation';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  private async auditPeriodCorrection(params: {
    tenantId: string;
    userId: string;
    periodId: string;
    outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
    reason?: string | null;
    payload?: any;
  }) {
    const finalReason =
      params.payload !== undefined
        ? JSON.stringify({ ...(params.payload ?? {}), reason: params.reason ?? null })
        : params.reason ?? null;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: params.tenantId,
          eventType: 'PERIOD_CORRECTED' as any,
          entityType: 'ACCOUNTING_PERIOD',
          entityId: params.periodId,
          action: 'FINANCE_PERIOD_CORRECT',
          outcome: params.outcome as any,
          reason: finalReason,
          userId: params.userId,
          permissionUsed: 'FINANCE_PERIOD_CORRECT',
        },
      })
      .catch(() => undefined);
  }

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

  async correctPeriod(req: Request, id: string, dto: CorrectPeriodDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const reason = String(dto?.reason ?? '').trim();
    if (reason.length < 3) {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'Correction reason is required',
      });
      throw new BadRequestException('Correction reason is required.');
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        createdById: true,
      },
    });

    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }

    if (period.status === 'CLOSED') {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'Cannot correct closed period. Governance requires: Reopen → Correct → Re-close.',
        payload: {
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          attemptedStartDate: dto.newStartDate ?? null,
          attemptedEndDate: dto.newEndDate ?? null,
        },
      });
      throw new ForbiddenException(
        'Cannot correct closed period. Governance requires: Reopen (FINANCE_PERIOD_REOPEN) → Correct (FINANCE_PERIOD_CORRECT) → Close (FINANCE_PERIOD_CLOSE).',
      );
    }

    const nextStartIso = (dto.newStartDate ?? '').trim() || new Date(period.startDate).toISOString().slice(0, 10);
    const nextEndIso = (dto.newEndDate ?? '').trim() || new Date(period.endDate).toISOString().slice(0, 10);

    const nextStartParsed = parseStrictIsoDate(nextStartIso);
    const nextEndParsed = parseStrictIsoDate(nextEndIso);
    if (!nextStartParsed.ok || !nextEndParsed.ok) {
      throwPeriodValidation([
        ...(!nextStartParsed.ok
          ? [
              {
                field: 'newStartDate',
                code: 'INVALID_CALENDAR_DATE',
                message: 'Start date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
              },
            ]
          : []),
        ...(!nextEndParsed.ok
          ? [
              {
                field: 'newEndDate',
                code: 'INVALID_CALENDAR_DATE',
                message: 'End date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
              },
            ]
          : []),
      ]);
    }

    const nextStart = nextStartParsed.date;
    const nextEnd = nextEndParsed.date;

    const changed =
      nextStart.toISOString().slice(0, 10) !== new Date(period.startDate).toISOString().slice(0, 10) ||
      nextEnd.toISOString().slice(0, 10) !== new Date(period.endDate).toISOString().slice(0, 10);

    if (!changed) {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'No changes requested',
        payload: {
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
        },
      });
      throw new BadRequestException('No changes were provided.');
    }

    try {
      validateMonthlyPeriodDates({
        type: period.type as any,
        startIso: nextStartIso,
        endIso: nextEndIso,
        startField: 'newStartDate',
        endField: 'newEndDate',
      });
    } catch (e) {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'Correction failed validation',
        payload: {
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
          error: (e as any)?.getResponse?.() ?? null,
        },
      });
      throw e;
    }

    const overlap = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        id: { not: period.id },
        startDate: { lte: nextEnd },
        endDate: { gte: nextStart },
      },
      select: { id: true, code: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'Correction would cause overlap with another period',
        payload: {
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
          overlapsWith: {
            id: overlap.id,
            code: overlap.code ?? null,
            name: overlap.name ?? null,
            startDate: overlap.startDate,
            endDate: overlap.endDate,
          },
        },
      });
      throwPeriodValidation([
        buildOverlapPeriodFieldError({
          field: 'newStartDate',
          overlap: {
            code: overlap.code ?? null,
            name: overlap.name ?? null,
            startDate: overlap.startDate,
            endDate: overlap.endDate,
          },
        }),
      ]);
    }

    const postedInOriginalRange = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        journalDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      select: { id: true, journalDate: true, createdById: true },
    });

    if (postedInOriginalRange) {
      const makerId = period.createdById;
      if (makerId && makerId === user.id) {
        await this.auditPeriodCorrection({
          tenantId: tenant.id,
          userId: user.id,
          periodId: id,
          outcome: 'BLOCKED',
          reason: 'SoD violation: period creator cannot correct a period that has posted journals',
          payload: {
            oldStartDate: period.startDate,
            oldEndDate: period.endDate,
            newStartDate: nextStart,
            newEndDate: nextEnd,
            periodCreatedById: makerId,
            examplePostedJournalId: postedInOriginalRange.id,
          },
        });
        throw new ForbiddenException('SoD violation: you cannot correct this period because it has posted journals and you are the period creator.');
      }
    }

    const orphanedPosted = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        journalDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
        OR: [{ journalDate: { lt: nextStart } }, { journalDate: { gt: nextEnd } }],
      },
      select: { id: true, journalDate: true },
    });

    if (orphanedPosted) {
      await this.auditPeriodCorrection({
        tenantId: tenant.id,
        userId: user.id,
        periodId: id,
        outcome: 'BLOCKED',
        reason: 'Cannot correct: posted journals would fall outside the corrected date range',
        payload: {
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
          exampleJournalId: orphanedPosted.id,
          exampleJournalDate: orphanedPosted.journalDate,
        },
      });
      throw new ForbiddenException('Cannot correct period: posted journals exist that would fall outside the corrected date range.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const correction = await (tx as any).accountingPeriodCorrection.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          oldStartDate: period.startDate,
          oldEndDate: period.endDate,
          newStartDate: nextStart,
          newEndDate: nextEnd,
          reason,
          correctedBy: user.id,
        },
      });

      const updatedPeriod = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          startDate: nextStart,
          endDate: nextEnd,
        },
      });

      return { updatedPeriod, correction };
    });

    await this.auditPeriodCorrection({
      tenantId: tenant.id,
      userId: user.id,
      periodId: id,
      outcome: 'SUCCESS',
      reason,
      payload: {
        code: period.code ?? null,
        name: period.name ?? null,
        type: period.type ?? null,
        oldStartDate: period.startDate,
        oldEndDate: period.endDate,
        newStartDate: nextStart,
        newEndDate: nextEnd,
        correctionId: (updated as any).correction?.id ?? null,
      },
    });

    return (updated as any).updatedPeriod;
  }
}
