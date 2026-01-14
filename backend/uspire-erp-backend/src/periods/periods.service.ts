import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import type { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';
import type { CorrectPeriodDto } from './dto/correct-period.dto';
import {
  buildOverlapPeriodFieldError,
  parseStrictIsoDate,
  throwPeriodValidation,
  validateMonthlyPeriodDates,
} from './period-validation';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';

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
    await writeAuditEventWithPrisma(
      {
        tenantId: params.tenantId,
        eventType: AuditEventType.PERIOD_CORRECTED,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: params.periodId,
        actorUserId: params.userId,
        timestamp: new Date(),
        outcome: params.outcome as any,
        action: 'FINANCE_PERIOD_CORRECT',
        permissionUsed: PERMISSIONS.PERIOD.CORRECT,
        reason: params.reason ?? undefined,
        metadata: params.payload ?? undefined,
        lifecycleType: 'PERIOD_CORRECT',
      },
      this.prisma,
    );
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

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_CREATED,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: created.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_CREATE',
        permissionUsed: PERMISSIONS.PERIOD.CREATE,
        lifecycleType: 'PERIOD_OPEN',
        metadata: {
          periodId: created.id,
          code: (created as any).code ?? null,
          name: (created as any).name ?? null,
          type: (created as any).type ?? null,
          startDate: (created as any).startDate ?? null,
          endDate: (created as any).endDate ?? null,
          status: (created as any).status ?? null,
        },
      },
      this.prisma,
    );

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

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_CLOSED,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_CLOSE',
        permissionUsed: PERMISSIONS.PERIOD.CLOSE,
        lifecycleType: 'PERIOD_CLOSE',
        metadata: {
          periodId: id,
          code: beforeAny?.code ?? null,
          type: beforeAny?.type ?? null,
          startDate: before?.startDate ?? null,
          endDate: before?.endDate ?? null,
          oldStatus: before?.status ?? null,
          newStatus: (updated as any).status ?? null,
        },
      },
      this.prisma,
    );

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

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.PERIOD_REOPENED,
        entityType: AuditEntityType.ACCOUNTING_PERIOD,
        entityId: id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FINANCE_PERIOD_REOPEN',
        permissionUsed: PERMISSIONS.PERIOD.REOPEN,
        lifecycleType: 'PERIOD_REOPEN',
        metadata: {
          periodId: id,
          reopenReason: String(dto?.reason ?? '').trim() || null,
          code: beforeAny?.code ?? null,
          type: beforeAny?.type ?? null,
          startDate: before?.startDate ?? null,
          endDate: before?.endDate ?? null,
          oldStatus: before?.status ?? null,
          newStatus: (updated as any).status ?? null,
        },
      },
      this.prisma,
    );

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
      void makerId;
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
