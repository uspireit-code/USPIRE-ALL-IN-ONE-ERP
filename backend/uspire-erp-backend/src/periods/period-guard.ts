export function assertCanCreate(): never {
  throw new Error(
    'Deprecated: use assertPeriodAllowsPosting (and canonical period semantics) instead of period-guard helpers.',
  );
}

export function assertCanPost(): never {
  throw new Error(
    'Deprecated: use assertPeriodAllowsPosting (and canonical period semantics) instead of period-guard helpers.',
  );
}

export function assertCanReverse(): never {
  throw new Error(
    'Deprecated: use assertPeriodAllowsPosting (and canonical period semantics) instead of period-guard helpers.',
  );
}
