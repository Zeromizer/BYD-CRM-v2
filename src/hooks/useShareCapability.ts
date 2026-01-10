import { useState, useEffect } from 'react'
import { useIsMobile } from './useMediaQuery'
import { canShareFiles } from '@/utils/fileShare'

/**
 * Hook to determine if share functionality should be shown
 * Returns true only on mobile devices that support file sharing
 */
export function useShareCapability(): boolean {
  const isMobile = useIsMobile()
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    // Only show share on mobile if the API is supported
    setCanShare(isMobile && canShareFiles())
  }, [isMobile])

  return canShare
}
