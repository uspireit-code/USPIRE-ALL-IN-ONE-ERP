import { ForbiddenException } from '@nestjs/common';
import { assertPeriodAllowsPosting } from './period-posting-governance';

describe('period posting governance', () => {
  it('allows normal posting in OPEN periods', () => {
    expect(() =>
      assertPeriodAllowsPosting({
        period: { id: 'period-open', name: 'Jan 2026', status: 'OPEN' },
        permissionUsed: 'gl.create',
      }),
    ).not.toThrow();
  });

  it('allows normal posting in ACTIVE periods', () => {
    expect(() =>
      assertPeriodAllowsPosting({
        period: { id: 'period-active', name: 'Feb 2026', status: 'ACTIVE' },
        permissionUsed: 'gl.create',
      }),
    ).not.toThrow();
  });

  it('blocks hard closed periods without treating them as normal posting periods', () => {
    expect(() =>
      assertPeriodAllowsPosting({
        period: { id: 'period-closed', name: 'Dec 2025', status: 'HARD_CLOSED' },
        permissionUsed: 'gl.create',
      }),
    ).toThrow(ForbiddenException);
  });
});
