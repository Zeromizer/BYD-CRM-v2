import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import './Auth.css';

type AuthView = 'login' | 'signup' | 'forgot-password';

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <h2>BYD CRM</h2>
      </div>

      {view === 'login' && (
        <LoginForm
          onSwitchToSignup={() => setView('signup')}
          onForgotPassword={() => setView('forgot-password')}
        />
      )}

      {view === 'signup' && (
        <SignupForm
          onSwitchToLogin={() => setView('login')}
        />
      )}

      {view === 'forgot-password' && (
        <ForgotPasswordForm
          onBack={() => setView('login')}
        />
      )}
    </div>
  );
}
