import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
        {...props}
      >
        {isLoading ? (
          <CircleNotch size={16} className="btn-spinner" />
        ) : (
          leftIcon && <span className="btn-icon">{leftIcon}</span>
        )}
        {children && <span className="btn-text">{children}</span>}
        {!isLoading && rightIcon && <span className="btn-icon">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
