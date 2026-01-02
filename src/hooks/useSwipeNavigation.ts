import { useState, useCallback, useRef, useEffect } from 'react';

interface SwipeState {
  activePanel: number;
  isSwiping: boolean;
  translateX: number;
  direction: 'left' | 'right' | null;
}

interface SwipeConfig {
  panelCount: number;
  threshold?: number;        // Minimum swipe distance to trigger navigation (default: 50px)
  velocityThreshold?: number; // Minimum velocity for quick swipes (default: 0.5)
  edgeWidth?: number;        // Edge detection zone for back navigation (default: 20px)
  resistance?: number;       // Resistance when swiping past bounds (default: 0.3)
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

interface UseSwipeNavigationReturn {
  activePanel: number;
  isSwiping: boolean;
  translateX: number;
  setActivePanel: (panel: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  getTransformStyle: () => React.CSSProperties;
}

export function useSwipeNavigation(config: SwipeConfig): UseSwipeNavigationReturn {
  const {
    panelCount,
    threshold = 50,
    velocityThreshold = 0.5,
    // edgeWidth reserved for future edge-swipe back navigation
    resistance = 0.3,
  } = config;

  const [state, setState] = useState<SwipeState>({
    activePanel: 0,
    isSwiping: false,
    translateX: 0,
    direction: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const touchCurrent = useRef<TouchPoint | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const containerWidth = useRef<number>(window.innerWidth);
  const stateRef = useRef(state);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Update container width on resize
  useEffect(() => {
    const handleResize = () => {
      containerWidth.current = window.innerWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setActivePanel = useCallback((panel: number) => {
    const clampedPanel = Math.max(0, Math.min(panel, panelCount - 1));
    setState((prev) => ({
      ...prev,
      activePanel: clampedPanel,
      translateX: 0,
      isSwiping: false,
      direction: null,
    }));
  }, [panelCount]);

  // Setup native touch event listeners with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchCurrent.current = touchStart.current;
      isHorizontalSwipe.current = null;

      setState((prev) => ({
        ...prev,
        isSwiping: true,
        direction: null,
      }));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;

      // Determine if this is a horizontal or vertical swipe (lock after threshold)
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // If it's a vertical swipe, don't interfere
      if (isHorizontalSwipe.current === false) {
        return;
      }

      // Prevent vertical scroll during horizontal swipe
      if (isHorizontalSwipe.current === true) {
        e.preventDefault();
      }

      touchCurrent.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Calculate translation with resistance at bounds
      let translateX = deltaX;
      const currentState = stateRef.current;
      const { activePanel } = currentState;

      // Apply resistance at boundaries
      if (activePanel === 0 && deltaX > 0) {
        // Swiping right at first panel
        translateX = deltaX * resistance;
      } else if (activePanel === panelCount - 1 && deltaX < 0) {
        // Swiping left at last panel
        translateX = deltaX * resistance;
      }

      setState((prev) => ({
        ...prev,
        translateX,
        direction: deltaX > 0 ? 'right' : 'left',
      }));
    };

    const handleTouchEnd = () => {
      if (!touchStart.current || !touchCurrent.current) {
        setState((prev) => ({ ...prev, isSwiping: false, translateX: 0 }));
        return;
      }

      const deltaX = touchCurrent.current.x - touchStart.current.x;
      const deltaTime = touchCurrent.current.time - touchStart.current.time;
      const velocity = Math.abs(deltaX) / deltaTime; // px per ms

      const currentState = stateRef.current;
      const { activePanel } = currentState;
      let newPanel = activePanel;

      // Check if swipe should trigger navigation
      const exceedsThreshold = Math.abs(deltaX) > threshold;
      const exceedsVelocity = velocity > velocityThreshold;
      const shouldNavigate = exceedsThreshold || exceedsVelocity;

      if (shouldNavigate && isHorizontalSwipe.current) {
        if (deltaX > 0 && activePanel > 0) {
          // Swipe right -> go to previous panel
          newPanel = activePanel - 1;
        } else if (deltaX < 0 && activePanel < panelCount - 1) {
          // Swipe left -> go to next panel
          newPanel = activePanel + 1;
        }
      }

      // Reset touch tracking
      touchStart.current = null;
      touchCurrent.current = null;
      isHorizontalSwipe.current = null;

      setState({
        activePanel: newPanel,
        isSwiping: false,
        translateX: 0,
        direction: null,
      });
    };

    // Add event listeners with passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [panelCount, threshold, velocityThreshold, resistance]);

  const getTransformStyle = useCallback((): React.CSSProperties => {
    // Calculate offset in vw units (viewport width) for consistent positioning
    // Each panel is 100vw wide, so panel 1 = -100vw, panel 2 = -200vw
    const baseOffset = -state.activePanel * 100;
    const swipeOffset = state.isSwiping
      ? (state.translateX / containerWidth.current) * 100
      : 0;

    return {
      transform: `translateX(${baseOffset + swipeOffset}vw)`,
      transition: state.isSwiping ? 'none' : 'transform 300ms ease-out',
    };
  }, [state.activePanel, state.isSwiping, state.translateX]);

  return {
    activePanel: state.activePanel,
    isSwiping: state.isSwiping,
    translateX: state.translateX,
    setActivePanel,
    containerRef,
    getTransformStyle,
  };
}

export default useSwipeNavigation;
