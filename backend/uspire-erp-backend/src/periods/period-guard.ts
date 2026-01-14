import { ForbiddenException } from '@nestjs/common';
import { PeriodStatus } from './period-semantics';

function toStatus(status: any): PeriodStatus {
  return status as PeriodStatus;
}

export function assertCanCreate(periodStatus: any) {
  const s = toStatus(periodStatus);
  if (s === PeriodStatus.CLOSED) {
    throw new ForbiddenException({
      error: 'Action blocked by accounting period control',
      reason: 'Accounting period is CLOSED',
    });
  }
}

export function assertCanPost(
  periodStatus: any,
  ctx?: { periodName?: string | null; documentLabel?: string },
) {
  const s = toStatus(periodStatus);
  const periodName = String(ctx?.periodName ?? '').trim();
  const periodSuffix = periodName ? `: ${periodName}` : '';
  const notOpenReason = `Accounting period is not OPEN${periodSuffix}`;
  if (s === PeriodStatus.SOFT_CLOSED) {
    throw new ForbiddenException({
      error: 'Posting blocked by accounting period control',
      reason: notOpenReason,
    });
  }
  if (s === PeriodStatus.CLOSED) {
    throw new ForbiddenException({
      error: 'Posting blocked by accounting period control',
      reason: notOpenReason,
    });
  }
}

export function assertCanReverse(
  periodStatus: any,
  ctx?: { periodName?: string | null },
) {
  const s = toStatus(periodStatus);
  const periodName = String(ctx?.periodName ?? '').trim();
  const periodSuffix = periodName ? `: ${periodName}` : '';
  const notOpenReason = `Accounting period is not OPEN${periodSuffix}`;
  if (s === PeriodStatus.SOFT_CLOSED) {
    throw new ForbiddenException({
      error: 'Reversal blocked by accounting period control',
      reason: notOpenReason,
    });
  }
  if (s === PeriodStatus.CLOSED) {
    throw new ForbiddenException({
      error: 'Reversal blocked by accounting period control',
      reason: notOpenReason,
    });
  }
}
