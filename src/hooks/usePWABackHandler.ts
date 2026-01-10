import { useEffect, useRef } from 'react'

/**
 * Hook to prevent PWA from exiting on back gesture
 * Uses a counter in history state to track position
 */
export function usePWABackHandler() {
  const counterRef = useRef(0)

  useEffect(() => {
    // Check if running as installed PWA
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    if (!isPWA) return

    // Initialize counter from current state or start fresh
    const currentState = window.history.state
    if (currentState?.pwaCounter !== undefined) {
      counterRef.current = currentState.pwaCounter
    } else {
      // First load - push initial state with counter
      counterRef.current = 1
      window.history.replaceState({ pwaCounter: 0 }, '', window.location.href)
      window.history.pushState({ pwaCounter: 1 }, '', window.location.href)
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state
      const counter = state?.pwaCounter ?? 0

      if (counter === 0) {
        // We're at the guard entry (first entry) - prevent exit
        // Push a new entry to go "forward" again
        counterRef.current = 1
        window.history.pushState({ pwaCounter: 1 }, '', window.location.href)
      } else {
        // Normal back navigation within app
        counterRef.current = counter
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Also update counter when navigating forward
  useEffect(() => {
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    if (!isPWA) return

    // When a new page is pushed (React Router navigation), update the counter
    const currentState = window.history.state
    if (currentState && currentState.pwaCounter === undefined) {
      // React Router pushed a state without our counter - add it
      counterRef.current += 1
      window.history.replaceState(
        { ...currentState, pwaCounter: counterRef.current },
        '',
        window.location.href
      )
    }
  })
}
