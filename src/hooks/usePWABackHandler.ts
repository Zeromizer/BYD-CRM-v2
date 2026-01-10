import { useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Hook to handle PWA back gesture on mobile
 * Prevents the app from exiting when using swipe-back gesture
 * Instead navigates within the app or stays on home
 */
export function usePWABackHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  // Check if running as installed PWA
  const isPWA = useCallback(() => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  }, [])

  useEffect(() => {
    if (!isPWA()) return

    // Push initial history entry to prevent immediate exit
    const initialState = { pwaBackHandler: true, path: location.pathname }

    // Only push if we don't already have our marker
    if (!window.history.state?.pwaBackHandler) {
      window.history.pushState(initialState, '', location.pathname + location.search)
    }

    const handlePopState = (event: PopStateEvent) => {
      // Check if this is our marker state or an actual navigation
      const isAtRoot = location.pathname === '/' || location.pathname === ''

      if (isAtRoot) {
        // At root - prevent exit by pushing state back
        event.preventDefault()
        window.history.pushState(
          { pwaBackHandler: true, path: '/' },
          '',
          location.pathname + location.search
        )
      } else {
        // Not at root - navigate back within the app
        // The browser has already popped, so we just let React Router handle it
        // But we need to push a new state to maintain our buffer
        setTimeout(() => {
          if (!window.history.state?.pwaBackHandler) {
            window.history.pushState(
              { pwaBackHandler: true, path: window.location.pathname },
              '',
              window.location.pathname + window.location.search
            )
          }
        }, 0)
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isPWA, location.pathname, location.search, navigate])
}
