/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.
 * Critical for production stability - prevents entire app from crashing.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Warning, ArrowCounterClockwise } from '@phosphor-icons/react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <Warning size={48} className="error-icon" />
            <h2>Something went wrong</h2>
            {/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Fallback on empty string */}
            <p className="error-message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {/* eslint-enable @typescript-eslint/prefer-nullish-coalescing */}
            <button className="error-retry-btn" onClick={this.handleRetry}>
              <ArrowCounterClockwise size={18} />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Lightweight functional wrapper for specific error scenarios
interface ErrorFallbackProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="error-boundary-fallback">
      <div className="error-boundary-content">
        <Warning size={48} className="error-icon" />
        <h2>{title}</h2>
        <p className="error-message">{message}</p>
        {onRetry && (
          <button className="error-retry-btn" onClick={onRetry}>
            <ArrowCounterClockwise size={18} />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
