import { useEffect, type ReactNode } from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import { useAuthStore, useIsAuthenticated, useAuthInitialized } from '@/stores'
import { AuthPage } from './AuthPage'
import './Auth.css'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const initialize = useAuthStore((state) => state.initialize)
  const isAuthenticated = useIsAuthenticated()
  const isInitialized = useAuthInitialized()

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div className="auth-loading">
        <CircleNotch size={48} className="spinner large" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage />
  }

  return <>{children}</>
}
