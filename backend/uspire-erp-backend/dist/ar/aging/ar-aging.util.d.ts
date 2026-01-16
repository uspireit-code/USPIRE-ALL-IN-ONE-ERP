export type ArAgingBucketCode = 'CURRENT' | '0_30' | '31_60' | '61_90' | '90_PLUS';
export declare function daysBetweenUtc(a: Date, b: Date): number;
export declare function bucketForDaysOverdue(daysOverdue: number): ArAgingBucketCode;
