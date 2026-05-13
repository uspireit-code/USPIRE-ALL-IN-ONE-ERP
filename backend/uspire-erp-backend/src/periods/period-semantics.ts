export enum PeriodStatus {
  OPEN = 'OPEN',
  SOFT_CLOSED = 'SOFT_CLOSED',
  HARD_CLOSED = 'HARD_CLOSED',
  ARCHIVED = 'ARCHIVED',
  // Legacy value retained for backward compatibility with existing data.
  CLOSED = 'CLOSED',
}
