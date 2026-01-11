import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useUserRole, useAuthInitialized } from '@/stores'
import type { UserRole } from '@/types'

interface RoleGuardProps {
  children: ReactNode
  /** Roles allowed to access this route */
  allowedRoles: UserRole[]
  /** Optional fallback content when access denied */
  fallback?: ReactNode
  /** Redirect path when access denied (default: '/') */
  redirectTo?: string
}

/**
 * RoleGuard - Protects routes based on user role
 *
 * Usage:
 * <RoleGuard allowedRoles={['manager']}>
 *   <UserManagement />
 * </RoleGuard>
 */
export function RoleGuard({ children, allowedRoles, fallback, redirectTo = '/' }: RoleGuardProps) {
  const role = useUserRole()
  const isInitialized = useAuthInitialized()

  // Still loading auth state
  if (!isInitialized) {
    return null
  }

  // Check if user has required role
  if (!role || !allowedRoles.includes(role)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
