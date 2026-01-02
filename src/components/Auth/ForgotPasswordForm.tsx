import { useState } from 'react';
import { Envelope, ArrowLeft, CircleNotch } from '@phosphor-icons/react';
import { useAuthStore } from '@/stores';
import './Auth.css';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const { resetPassword, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch {
      // Error is handled by the store
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>
          <div className="auth-success">
            <p>Click the link in your email to reset your password.</p>
          </div>
          <div className="auth-footer">
            <button type="button" onClick={onBack} className="auth-link">
              <ArrowLeft size={16} className="back-icon" />
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <div className="input-wrapper">
              <Envelope size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="form-input"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="auth-button"
          >
            {isLoading ? (
              <>
                <CircleNotch size={18} className="spinner" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" onClick={onBack} className="auth-link">
            <ArrowLeft size={16} className="back-icon" />
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
