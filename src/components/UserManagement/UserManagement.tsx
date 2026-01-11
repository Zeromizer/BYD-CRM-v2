/**
 * UserManagement Component
 * Allows managers to view users and change their roles
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CircleNotch,
  Users,
  UserPlus,
  MagnifyingGlass,
  CaretDown,
  Check,
  Warning,
  ShieldCheck,
  Eye,
  Briefcase,
} from '@phosphor-icons/react'
import { Modal, Button } from '@/components/common'
import { useToast } from '@/components/common'
import { getSupabase } from '@/lib/supabase'
import { useProfile } from '@/stores'
import type { Profile, UserRole } from '@/types'
import { ROLE_LABELS } from '@/types'
import './UserManagement.css'

const ROLE_OPTIONS: {
  value: UserRole
  label: string
  icon: typeof ShieldCheck
  description: string
}[] = [
  {
    value: 'manager',
    label: 'Manager',
    icon: ShieldCheck,
    description: 'Full access + user management',
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Eye,
    description: 'View-only access to all data',
  },
  {
    value: 'sales_consultant',
    label: 'Sales Consultant',
    icon: Briefcase,
    description: 'Own customers only',
  },
]

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('sales_consultant')
  const [isInviting, setIsInviting] = useState(false)
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  const currentProfile = useProfile()
  const { success, error: toastError } = useToast()

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data as Profile[])
    } catch (err) {
      toastError(`Failed to load users: ${(err as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    // Prevent changing own role
    if (userId === currentProfile?.id) {
      toastError('You cannot change your own role')
      setOpenRoleDropdown(null)
      return
    }

    setUpdatingRole(userId)
    try {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      success(`Role updated to ${ROLE_LABELS[newRole]}`)
    } catch (err) {
      toastError(`Failed to update role: ${(err as Error).message}`)
    } finally {
      setUpdatingRole(null)
      setOpenRoleDropdown(null)
    }
  }

  // Handle invite user (placeholder - requires Edge Function)
  const handleInviteUser = () => {
    if (!inviteEmail.trim()) {
      toastError('Please enter an email address')
      return
    }

    setIsInviting(true)
    // This would call a Supabase Edge Function that uses the admin API
    // For now, show a message about manual setup
    toastError(
      'User invitation requires Edge Function setup. Please add users manually in Supabase Dashboard.'
    )

    // TODO: Implement Edge Function call
    // const { data, error } = await getSupabase().functions.invoke('invite-user', {
    //   body: { email: inviteEmail, role: inviteRole },
    // })

    setIsInviting(false)
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('sales_consultant')
  }

  // Filter users by search query
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    return (
      user.email.toLowerCase().includes(query) ||
      (user.display_name?.toLowerCase().includes(query) ?? false)
    )
  })

  // Get role icon
  const getRoleIcon = (role: UserRole) => {
    const roleOption = ROLE_OPTIONS.find((r) => r.value === role)
    return roleOption?.icon ?? Briefcase
  }

  if (isLoading) {
    return (
      <div className="user-management-loading">
        <CircleNotch size={48} className="spinner large" />
        <p>Loading users...</p>
      </div>
    )
  }

  return (
    <div className="user-management">
      <header className="user-management-header">
        <div className="header-title">
          <Users size={24} weight="bold" />
          <h1>User Management</h1>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <MagnifyingGlass size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus size={18} />
            Invite User
          </Button>
        </div>
      </header>

      <div className="user-list">
        <div className="user-list-header">
          <span className="col-user">User</span>
          <span className="col-role">Role</span>
          <span className="col-joined">Joined</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>No users found</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const RoleIcon = getRoleIcon(user.role)
            const isCurrentUser = user.id === currentProfile?.id
            const isUpdating = updatingRole === user.id

            return (
              <div key={user.id} className={`user-item ${isCurrentUser ? 'current-user' : ''}`}>
                <div className="col-user">
                  <div className="user-avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name ?? user.email} />
                    ) : (
                      <span>{(user.display_name ?? user.email).charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="user-info">
                    <span className="user-name">
                      {user.display_name ?? user.email.split('@')[0]}
                      {isCurrentUser && <span className="you-badge">You</span>}
                    </span>
                    <span className="user-email">{user.email}</span>
                  </div>
                </div>

                <div className="col-role">
                  <div className="role-dropdown-wrapper">
                    <button
                      className={`role-button ${isCurrentUser ? 'disabled' : ''}`}
                      onClick={() =>
                        !isCurrentUser &&
                        setOpenRoleDropdown(openRoleDropdown === user.id ? null : user.id)
                      }
                      disabled={isCurrentUser || isUpdating}
                    >
                      {isUpdating ? (
                        <CircleNotch size={16} className="spinner" />
                      ) : (
                        <RoleIcon size={16} />
                      )}
                      <span>{ROLE_LABELS[user.role]}</span>
                      {!isCurrentUser && <CaretDown size={14} />}
                    </button>

                    {openRoleDropdown === user.id && (
                      <div className="role-dropdown">
                        {ROLE_OPTIONS.map((option) => {
                          const OptionIcon = option.icon
                          const isSelected = user.role === option.value

                          return (
                            <button
                              key={option.value}
                              className={`role-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleRoleChange(user.id, option.value)}
                            >
                              <OptionIcon size={18} />
                              <div className="role-option-text">
                                <span className="role-option-label">{option.label}</span>
                                <span className="role-option-desc">{option.description}</span>
                              </div>
                              {isSelected && <Check size={16} />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-joined">{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
            )
          })
        )}
      </div>

      {/* Invite User Modal */}
      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite User">
        <div className="invite-form">
          <div className="form-note">
            <Warning size={18} />
            <p>
              User invitations require a Supabase Edge Function. For now, please add users manually
              in the Supabase Dashboard and they will appear here.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="invite-email">Email Address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? (
                <>
                  <CircleNotch size={18} className="spinner" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Click outside to close dropdown */}
      {openRoleDropdown && (
        <div className="dropdown-overlay" onClick={() => setOpenRoleDropdown(null)} />
      )}
    </div>
  )
}
