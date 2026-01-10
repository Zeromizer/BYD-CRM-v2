import { useState } from 'react'
import { Envelope, Lock, Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores'
import './Auth.css'

interface LoginFormProps {
  onSwitchToSignup: () => void
  onForgotPassword: () => void
}

export function LoginForm({ onSwitchToSignup, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { signIn, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await signIn({ email, password })
    } catch {
      // Error is handled by the store
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your BYD CRM account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

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
                autoComplete="current-password"
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

          <button type="button" onClick={onForgotPassword} className="forgot-password-link">
            Forgot password?
          </button>

          <button type="submit" disabled={isLoading} className="auth-button">
            {isLoading ? (
              <>
                <CircleNotch size={18} className="spinner" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button type="button" onClick={onSwitchToSignup} className="auth-link">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
