import { buildOverlapPeriodFieldError, validateMonthlyPeriodDates } from './period-validation';

describe('Accounting period date validation', () => {
  it('fails 2026-09-31 with INVALID_END_OF_MONTH on endDate', () => {
    expect(() =>
      validateMonthlyPeriodDates({
        type: 'NORMAL',
        startIso: '2026-09-01',
        endIso: '2026-09-31',
        startField: 'startDate',
        endField: 'endDate',
      }),
    ).toThrow();

    try {
      validateMonthlyPeriodDates({
        type: 'NORMAL',
        startIso: '2026-09-01',
        endIso: '2026-09-31',
        startField: 'startDate',
        endField: 'endDate',
      });
    } catch (e: any) {
      const resp = e?.getResponse?.() ?? {};
      expect(resp.error).toBe('VALIDATION_FAILED');
      expect(resp.fieldErrors?.[0]?.field).toBe('endDate');
      expect(resp.fieldErrors?.[0]?.code).toBe('INVALID_END_OF_MONTH');
    }
  });

  it('fails when end is before start with END_BEFORE_START', () => {
    try {
      validateMonthlyPeriodDates({
        type: 'NORMAL',
        startIso: '2026-09-01',
        endIso: '2026-08-31',
        startField: 'startDate',
        endField: 'endDate',
      });
      throw new Error('expected to throw');
    } catch (e: any) {
      const resp = e?.getResponse?.() ?? {};
      expect(resp.fieldErrors?.[0]?.code).toBe('END_BEFORE_START');
    }
  });

  it('passes for 2026-09-01 to 2026-09-30', () => {
    const res = validateMonthlyPeriodDates({
      type: 'NORMAL',
      startIso: '2026-09-01',
      endIso: '2026-09-30',
      startField: 'startDate',
      endField: 'endDate',
    });

    expect(res.start.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(res.end.toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('builds OVERLAP_PERIOD field error with existing period label', () => {
    const fe = buildOverlapPeriodFieldError({
      field: 'startDate',
      overlap: {
        code: 'APR-2026',
        name: null,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-04-30T00:00:00.000Z'),
      },
    });

    expect(fe.code).toBe('OVERLAP_PERIOD');
    expect(fe.field).toBe('startDate');
    expect(fe.message).toContain('APR-2026');
    expect(fe.message).toContain('2026-04-01');
    expect(fe.message).toContain('2026-04-30');
  });
});
