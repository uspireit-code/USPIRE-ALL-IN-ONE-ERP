import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertPeriodAllowsPosting } from '../../periods/period-posting-governance';
import type { Request } from 'express';

export type AccountingPeriodGuardAction = 'create' | 'post';

export async function assertPeriodIsOpen(params: {
  req?: Request;
  prisma: PrismaService;
  tenantId: string;
  date: Date;
  action: AccountingPeriodGuardAction;
  documentLabel: string;
  dateLabel?: string;
}) {
  const d = params.date;
  if (!d || Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }

  const period = await params.prisma.accountingPeriod.findFirst({
    where: {
      tenantId: params.tenantId,
      startDate: { lte: d },
      endDate: { gte: d },
    },
    select: { id: true, code: true, name: true, status: true },
  });

  const ymd = d.toISOString().slice(0, 10);
  const dateLabel = params.dateLabel ?? 'invoice date';

  if (!period) {
    throw new BadRequestException(
      `No accounting period exists for ${dateLabel} ${ymd}.`,
    );
  }

  try {
    if (params.action === 'post') {
      assertPeriodAllowsPosting({
        ...(params.req ? { req: params.req } : {}),
        period,
        // Best-effort: this utility enforces posting controls; individual services should
        // supply the actual permissionUsed in their own audit events.
        permissionUsed: 'PERIOD_POST',
        ...(params.req
          ? {}
          : {
              // No req -> no permissions/reason headers -> conservative: no override.
              context: { permissionCodes: [] },
            }),
      });
    } else {
      // Legacy helper semantics require OPEN for create.
      // We use canonical period semantics but preserve the legacy error message below.
      assertPeriodAllowsPosting({
        ...(params.req ? { req: params.req } : {}),
        period,
        permissionUsed: 'PERIOD_POST',
        ...(params.req ? {} : { context: { permissionCodes: [] } }),
      });
    }
  } catch {
    const code = String(period.code ?? period.name ?? '').trim() || 'UNKNOWN';
    const status = String(period.status);
    const actionWord = params.action === 'post' ? 'post' : 'create';
    throw new ForbiddenException(
      `Cannot ${actionWord} ${params.documentLabel}. Accounting period ${code} is ${status}.`,
    );
  }

  return period;
}
