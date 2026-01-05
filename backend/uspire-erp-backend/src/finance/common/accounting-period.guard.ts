import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AccountingPeriodGuardAction = 'create' | 'post';

export async function assertPeriodIsOpen(params: {
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

  if (period.status !== 'OPEN') {
    const code = String(period.code ?? period.name ?? '').trim() || 'UNKNOWN';
    const status = String(period.status);
    const actionWord = params.action === 'post' ? 'post' : 'create';
    throw new ForbiddenException(
      `Cannot ${actionWord} ${params.documentLabel}. Accounting period ${code} is ${status}.`,
    );
  }

  return period;
}
