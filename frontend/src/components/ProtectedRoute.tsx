import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute(props: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.isBootstrapping) return <div>Loading...</div>;
  if (!state.isAuthenticated) return <Navigate to="/login" replace />;
  if (!state.me) return <div>Loading...</div>;
  return props.children;
}
