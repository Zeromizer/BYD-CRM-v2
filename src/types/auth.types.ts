/**
 * Authentication type definitions
 */

import type { User, Session } from '@supabase/supabase-js'
import type { UserSettings, Timestamps } from './common.types'

// User roles
export type UserRole = 'sales_consultant' | 'admin' | 'manager'

// Role display names
export const ROLE_LABELS: Record<UserRole, string> = {
  sales_consultant: 'Sales Consultant',
  admin: 'Admin',
  manager: 'Manager',
}

// Role permissions for frontend checks
export interface RolePermissions {
  canViewAllCustomers: boolean
  canEditCustomers: boolean
  canDeleteCustomers: boolean
  canCreateCustomers: boolean
  canManageUsers: boolean
  canInviteUsers: boolean
  canManageTemplates: boolean
}

// Permission configuration per role
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  sales_consultant: {
    canViewAllCustomers: false,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canCreateCustomers: true,
    canManageUsers: false,
    canInviteUsers: false,
    canManageTemplates: true,
  },
  admin: {
    canViewAllCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canCreateCustomers: false,
    canManageUsers: false,
    canInviteUsers: false,
    canManageTemplates: false,
  },
  manager: {
    canViewAllCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canCreateCustomers: true,
    canManageUsers: true,
    canInviteUsers: true,
    canManageTemplates: true,
  },
}

// User profile (extends Supabase auth.users)
export interface Profile extends Timestamps {
  id: string // UUID from auth.users
  email: string
  display_name: string | null
  avatar_url: string | null
  settings: UserSettings
  role: UserRole
  invited_by: string | null
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>
export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id' | 'email'>>

// Auth state
export interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null
}

// Auth credentials
export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends SignInCredentials {
  displayName: string
}
