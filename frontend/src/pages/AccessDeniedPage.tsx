import { Alert } from '../components/Alert';

export function AccessDeniedPage(props: { requiredPermission?: string; requiredAnyPermissions?: string[] }) {
  const required = String(props.requiredPermission ?? '').trim();
  const requiredAny = (props.requiredAnyPermissions ?? []).map((p) => String(p ?? '').trim()).filter(Boolean);
  const message = required
    ? `You don’t have permission to access this page. Required: ${required}.`
    : requiredAny.length > 0
      ? `You don’t have permission to access this page. Required: one of ${requiredAny.join(', ')}.`
      : 'You are not authorized to access this area.';

  return (
    <div>
      <Alert tone="error" title="Access Denied">
        {message}
      </Alert>
    </div>
  );
}
