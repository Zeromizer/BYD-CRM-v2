import { useEffect, type ReactNode } from 'react';
import { useAuthStore, useIsAuthenticated, useAuthInitialized } from '@/stores';
import { AuthPage } from './AuthPage';
import { Loader2 } from 'lucide-react';
import './Auth.css';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useIsAuthenticated();
  const isInitialized = useAuthInitialized();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="auth-loading">
        <Loader2 className="spinner" size={32} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <>{children}</>;
}
