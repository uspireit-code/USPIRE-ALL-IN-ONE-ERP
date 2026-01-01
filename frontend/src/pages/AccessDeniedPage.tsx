import { Alert } from '../components/Alert';

export function AccessDeniedPage() {
  return (
    <div>
      <Alert tone="error" title="Access Denied">
        You are not authorized to access this area.
      </Alert>
    </div>
  );
}
