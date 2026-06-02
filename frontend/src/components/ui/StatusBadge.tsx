import './StatusBadge.css';

export type StatusBadgeState =
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'DRAFT'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'RETIRED'
  | string;

function normalizeState(state: StatusBadgeState): string {
  return String(state ?? '').trim().toUpperCase();
}

export function StatusBadge(props: { state: StatusBadgeState; label?: string }) {
  const state = normalizeState(props.state);

  const variant =
    state === 'PENDING_APPROVAL'
      ? 'pending'
      : state === 'REJECTED'
        ? 'rejected'
        : state === 'ACTIVE' || state === 'APPROVED'
          ? 'active'
          : state === 'SUSPENDED' || state === 'ARCHIVED'
            ? 'rejected'
            : state === 'DRAFT'
            ? 'draft'
            : 'draft';

  const label = props.label ?? (state === 'PENDING_APPROVAL' ? 'PENDING APPROVAL' : state);

  return <span className={`ui-statusBadge ui-statusBadge--${variant}`}>{label}</span>;
}
