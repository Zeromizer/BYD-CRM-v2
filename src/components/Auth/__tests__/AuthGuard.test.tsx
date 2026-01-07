import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthGuard } from '../AuthGuard'

// Mock the stores
const mockInitialize = vi.fn()
let mockIsAuthenticated = false
let mockIsInitialized = false

vi.mock('@/stores', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => {
    const state = { initialize: mockInitialize }
    return selector(state)
  },
  useIsAuthenticated: () => mockIsAuthenticated,
  useAuthInitialized: () => mockIsInitialized,
}))

// Mock AuthPage
vi.mock('../AuthPage', () => ({
  AuthPage: () => <div data-testid="auth-page">Login Page</div>,
}))

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false
    mockIsInitialized = false
  })

  it('shows loading state when not initialized', () => {
    mockIsInitialized = false

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('shows AuthPage when initialized but not authenticated', () => {
    mockIsInitialized = true
    mockIsAuthenticated = false

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('shows children when authenticated', () => {
    mockIsInitialized = true
    mockIsAuthenticated = true

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument()
  })

  it('calls initialize on mount', () => {
    mockIsInitialized = true
    mockIsAuthenticated = true

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(mockInitialize).toHaveBeenCalled()
  })
})
