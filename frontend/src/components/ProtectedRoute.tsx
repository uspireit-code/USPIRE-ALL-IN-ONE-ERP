import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthLoadingScreen } from './AuthBootstrapGate';

export function ProtectedRoute(props: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.isBootstrapping) return <AuthLoadingScreen />;
  if (!state.isAuthenticated) return <Navigate to="/login" replace />;
  if (!state.me) return <AuthLoadingScreen />;
  return props.children;
}
