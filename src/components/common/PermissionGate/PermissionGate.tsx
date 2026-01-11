import { type ReactNode } from 'react'
import { usePermissions } from '@/stores'
import type { RolePermissions } from '@/types'

interface PermissionGateProps {
  children: ReactNode
  /** Permission key to check */
  permission: keyof RolePermissions
  /** Optional fallback content when permission denied */
  fallback?: ReactNode
}

/**
 * PermissionGate - Conditionally renders children based on user permissions
 *
 * Usage:
 * <PermissionGate permission="canEditCustomers">
 *   <Button onClick={handleEdit}>Edit</Button>
 * </PermissionGate>
 *
 * With fallback:
 * <PermissionGate permission="canEditCustomers" fallback={<span>View Only</span>}>
 *   <Button onClick={handleEdit}>Edit</Button>
 * </PermissionGate>
 */
export function PermissionGate({ children, permission, fallback = null }: PermissionGateProps) {
  const permissions = usePermissions()

  if (!permissions[permission]) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
