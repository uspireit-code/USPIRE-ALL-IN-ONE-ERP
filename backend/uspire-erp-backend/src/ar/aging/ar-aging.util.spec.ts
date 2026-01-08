import { bucketForDaysOverdue } from './ar-aging.util';

describe('AR Aging bucketing', () => {
  it('buckets CURRENT when not overdue', () => {
    expect(bucketForDaysOverdue(-1)).toBe('CURRENT');
    expect(bucketForDaysOverdue(-10)).toBe('CURRENT');
  });

  it('buckets 0_30', () => {
    expect(bucketForDaysOverdue(0)).toBe('0_30');
    expect(bucketForDaysOverdue(30)).toBe('0_30');
  });

  it('buckets 31_60', () => {
    expect(bucketForDaysOverdue(31)).toBe('31_60');
    expect(bucketForDaysOverdue(60)).toBe('31_60');
  });

  it('buckets 61_90', () => {
    expect(bucketForDaysOverdue(61)).toBe('61_90');
    expect(bucketForDaysOverdue(90)).toBe('61_90');
  });

  it('buckets 90_PLUS', () => {
    expect(bucketForDaysOverdue(91)).toBe('90_PLUS');
    expect(bucketForDaysOverdue(500)).toBe('90_PLUS');
  });
});
