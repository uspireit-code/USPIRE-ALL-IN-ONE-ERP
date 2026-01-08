import { BadRequestException } from '@nestjs/common';

export type PeriodFieldErrorCode =
  | 'INVALID_CALENDAR_DATE'
  | 'INVALID_END_OF_MONTH'
  | 'END_BEFORE_START'
  | 'OVERLAP_PERIOD'
  | 'START_NOT_MONTH_START'
  | 'END_NOT_MONTH_END'
  | 'OPENING_NOT_SINGLE_DAY';

export type PeriodFieldError = {
  field: 'startDate' | 'endDate' | 'newStartDate' | 'newEndDate' | 'type' | 'code' | string;
  code: PeriodFieldErrorCode | string;
  message: string;
};

export function buildOverlapPeriodFieldError(params: {
  field: PeriodFieldError['field'];
  overlap: {
    code?: string | null;
    name?: string | null;
    startDate: Date;
    endDate: Date;
  };
}): PeriodFieldError {
  const label = params.overlap.code || params.overlap.name || 'an existing period';
  return {
    field: params.field,
    code: 'OVERLAP_PERIOD',
    message: `This period overlaps with ${label} (${formatIsoDate(params.overlap.startDate)} to ${formatIsoDate(params.overlap.endDate)}).`,
  };
}

export function throwPeriodValidation(fieldErrors: PeriodFieldError[]): never {
  throw new BadRequestException({
    error: 'VALIDATION_FAILED',
    message: 'Please fix the highlighted fields and try again.',
    fieldErrors,
  });
}

export function formatIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function formatMonthYear(d: Date) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function lastDayOfMonthUtc(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0));
}

export function parseStrictIsoDate(input: string):
  | { ok: true; date: Date; year: number; month: number; day: number }
  | { ok: false } {
  const v = String(input ?? '').trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
  if (!m) return { ok: false };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return { ok: false };
  if (month < 1 || month > 12) return { ok: false };
  if (day < 1 || day > 31) return { ok: false };
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { ok: false };
  }
  return { ok: true, date: d, year, month, day };
}

function parseIsoParts(input: string): { year: number; month: number; day: number } | null {
  const v = String(input ?? '').trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

export function validateMonthlyPeriodDates(params: {
  type: 'OPENING' | 'NORMAL';
  startIso: string;
  endIso: string;
  startField: string;
  endField: string;
}) {
  const fieldErrors: PeriodFieldError[] = [];

  const startParsed = parseStrictIsoDate(params.startIso);
  if (!startParsed.ok) {
    const parts = parseIsoParts(params.startIso);
    if (parts && parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31) {
      const last = lastDayOfMonthUtc(parts.year, parts.month);
      const lastDay = last.getUTCDate();
      if (parts.day > lastDay) {
        fieldErrors.push({
          field: params.startField,
          code: 'INVALID_END_OF_MONTH',
          message: `${formatMonthYear(last)} has ${lastDay} days. Please use ${formatIsoDate(last)}.`,
        });
      } else {
        fieldErrors.push({
          field: params.startField,
          code: 'INVALID_CALENDAR_DATE',
          message: 'Start date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
        });
      }
    } else {
      fieldErrors.push({
        field: params.startField,
        code: 'INVALID_CALENDAR_DATE',
        message: 'Start date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
      });
    }
  }

  const endParsed = parseStrictIsoDate(params.endIso);
  if (!endParsed.ok) {
    const parts = parseIsoParts(params.endIso);
    if (parts && parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31) {
      const last = lastDayOfMonthUtc(parts.year, parts.month);
      const lastDay = last.getUTCDate();
      if (parts.day > lastDay) {
        fieldErrors.push({
          field: params.endField,
          code: 'INVALID_END_OF_MONTH',
          message: `${formatMonthYear(last)} has ${lastDay} days. Please use ${formatIsoDate(last)}.`,
        });
      } else {
        fieldErrors.push({
          field: params.endField,
          code: 'INVALID_CALENDAR_DATE',
          message: 'End date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
        });
      }
    } else {
      fieldErrors.push({
        field: params.endField,
        code: 'INVALID_CALENDAR_DATE',
        message: 'End date is not a valid calendar date. Please use a real date (YYYY-MM-DD).',
      });
    }
  }

  if (fieldErrors.length > 0) {
    throwPeriodValidation(fieldErrors);
  }

  if (!startParsed.ok || !endParsed.ok) {
    throwPeriodValidation([
      {
        field: params.startField,
        code: 'INVALID_CALENDAR_DATE',
        message: 'Please enter valid start and end dates and try again.',
      },
    ]);
  }

  const start = startParsed.date;
  const end = endParsed.date;

  if (end.getTime() < start.getTime()) {
    throwPeriodValidation([
      {
        field: params.endField,
        code: 'END_BEFORE_START',
        message: 'End date cannot be earlier than start date.',
      },
    ]);
  }

  if (params.type === 'OPENING') {
    const startIso = formatIsoDate(start);
    const endIso = formatIsoDate(end);
    if (startIso !== endIso) {
      throwPeriodValidation([
        {
          field: params.endField,
          code: 'OPENING_NOT_SINGLE_DAY',
          message: 'Opening period must be a single day (start date must equal end date).',
        },
      ]);
    }
    return { start, end };
  }

  const monthYear = formatMonthYear(end);
  const last = lastDayOfMonthUtc(endParsed.year, endParsed.month);
  const lastDay = last.getUTCDate();
  const expectedEnd = formatIsoDate(last);

  if (endParsed.day !== lastDay) {
    const isSameMonth =
      startParsed.year === endParsed.year && startParsed.month === endParsed.month;
    if (isSameMonth) {
      throwPeriodValidation([
        {
          field: params.endField,
          code: 'END_NOT_MONTH_END',
          message: `End date must be the last day of the month (e.g., ${expectedEnd}).`,
        },
      ]);
    }

    throwPeriodValidation([
      {
        field: params.endField,
        code: 'INVALID_END_OF_MONTH',
        message: `${monthYear} has ${lastDay} days. Please use ${expectedEnd}.`,
      },
    ]);
  }

  if (startParsed.day !== 1) {
    const expectedStart = `${String(startParsed.year).padStart(4, '0')}-${String(
      startParsed.month,
    ).padStart(2, '0')}-01`;
    throwPeriodValidation([
      {
        field: params.startField,
        code: 'START_NOT_MONTH_START',
        message: `Start date must be the first day of the month (e.g., ${expectedStart}).`,
      },
    ]);
  }

  if (startParsed.year !== endParsed.year || startParsed.month !== endParsed.month) {
    const expectedStart = `${String(endParsed.year).padStart(4, '0')}-${String(
      endParsed.month,
    ).padStart(2, '0')}-01`;
    throwPeriodValidation([
      {
        field: params.startField,
        code: 'START_NOT_MONTH_START',
        message: `Start date must be the first day of the same month as the end date (e.g., ${expectedStart}).`,
      },
    ]);
  }

  return { start, end };
}
