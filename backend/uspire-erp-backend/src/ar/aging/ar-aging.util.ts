export type ArAgingBucketCode = 'CURRENT' | '0_30' | '31_60' | '61_90' | '90_PLUS';

export function daysBetweenUtc(a: Date, b: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const aUtc = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((aUtc - bUtc) / msPerDay);
}

export function bucketForDaysOverdue(daysOverdue: number): ArAgingBucketCode {
  if (daysOverdue < 0) return 'CURRENT';
  if (daysOverdue <= 30) return '0_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return '90_PLUS';
}
