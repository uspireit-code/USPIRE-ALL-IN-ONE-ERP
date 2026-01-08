export type PeriodFieldErrorCode = 'INVALID_CALENDAR_DATE' | 'INVALID_END_OF_MONTH' | 'END_BEFORE_START' | 'OVERLAP_PERIOD' | 'START_NOT_MONTH_START' | 'END_NOT_MONTH_END' | 'OPENING_NOT_SINGLE_DAY';
export type PeriodFieldError = {
    field: 'startDate' | 'endDate' | 'newStartDate' | 'newEndDate' | 'type' | 'code' | string;
    code: PeriodFieldErrorCode | string;
    message: string;
};
export declare function buildOverlapPeriodFieldError(params: {
    field: PeriodFieldError['field'];
    overlap: {
        code?: string | null;
        name?: string | null;
        startDate: Date;
        endDate: Date;
    };
}): PeriodFieldError;
export declare function throwPeriodValidation(fieldErrors: PeriodFieldError[]): never;
export declare function formatIsoDate(d: Date): string;
export declare function formatMonthYear(d: Date): string;
export declare function parseStrictIsoDate(input: string): {
    ok: true;
    date: Date;
    year: number;
    month: number;
    day: number;
} | {
    ok: false;
};
export declare function validateMonthlyPeriodDates(params: {
    type: 'OPENING' | 'NORMAL';
    startIso: string;
    endIso: string;
    startField: string;
    endField: string;
}): {
    start: Date;
    end: Date;
};
