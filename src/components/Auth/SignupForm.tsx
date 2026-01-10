import { useState } from 'react'
import { User, Envelope, Lock, Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores'
import './Auth.css'

interface SignupFormProps {
  onSwitchToLogin: () => void
}

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { signUp, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters')
      return
    }

    try {
      await signUp({ email, password, displayName })
      setSuccess(true)
    } catch {
      // Error is handled by the store
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We've sent a confirmation link to <strong>{email}</strong>
            </p>
          </div>
          <div className="auth-success">
            <p>Please click the link in your email to verify your account.</p>
          </div>
          <div className="auth-footer">
            <button type="button" onClick={onSwitchToLogin} className="auth-link">
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Get started with BYD CRM</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {(error ?? localError) && <div className="auth-error">{error ?? localError}</div>}

          <div className={`form-group ${displayName ? 'has-value' : ''}`}>
            <label htmlFor="displayName" className="form-label">
              Name
            </label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className={`form-group ${email ? 'has-value' : ''}`}>
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <div className="input-wrapper">
              <Envelope size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className={`form-group ${password ? 'has-value' : ''}`}>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={`form-group ${confirmPassword ? 'has-value' : ''}`}>
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="auth-button">
            {isLoading ? (
              <>
                <CircleNotch size={18} className="spinner" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin} className="auth-link">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
