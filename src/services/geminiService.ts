/**
 * AI Service for ID/License Extraction
 * Calls Supabase Edge Function which uses Claude Haiku
 * API key stored in Edge Function Secrets (not client-side)
 */

import { getSupabase } from '@/lib/supabase'
import { debug } from '@/utils/debug'

// Edge function response types
interface ExtractIDResponse {
  name?: string
  nric?: string
  dob?: string
  address?: string
  addressContinue?: string
  confidence?: number
  licenseStartDate?: string
  error?: string
}

interface EdgeFunctionError {
  message?: string
}

export interface ExtractedIDData {
  name: string
  nric: string
  dob: string
  address: string
  addressContinue: string
  confidence: number
}

export interface ExtractedLicenseData {
  licenseStartDate: string
  confidence: number
}

export interface ProcessingProgress {
  stage: string
  progress: number
}

/**
 * Check if the AI service is available (requires internet)
 */
export function isAIServiceAvailable(): boolean {
  return navigator.onLine
}

/**
 * Pre-warm the edge function to eliminate cold start latency
 * Call this when the ID scanner modal opens
 */
export async function preWarmEdgeFunction(): Promise<void> {
  if (!navigator.onLine) return
  try {
    const supabase = getSupabase()
    await supabase.functions.invoke('extract-id', {
      body: { type: 'ping' },
    })
  } catch {
    // Ignore errors - this is just pre-warming
  }
}

/**
 * Extract ID details using Claude AI via Edge Function
 * Sends both front and back images in a single request
 */
export async function extractIDWithGemini(
  frontImageData: string,
  backImageData: string | null = null,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedIDData> {
  const startTime = performance.now()

  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.')
  }

  onProgress?.({ stage: 'Analyzing ID with AI...', progress: 10 })

  // Use cached session for faster auth check
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Please sign in to use the scanner.')
  }

  const authTime = performance.now() - startTime
  debug.log('[ID Scan] Auth check:', Math.round(authTime), 'ms')

  onProgress?.({ stage: 'Processing with AI...', progress: 30 })

  debug.log('Calling extract-id Edge Function...')
  debug.log('Front image size:', frontImageData.length, 'chars')
  debug.log('Back image size:', backImageData?.length ?? 0, 'chars')

  const edgeStart = performance.now()
  const response = await supabase.functions.invoke<ExtractIDResponse>('extract-id', {
    body: {
      type: 'id',
      frontImage: frontImageData,
      backImage: backImageData,
    },
  })
  const edgeTime = performance.now() - edgeStart
  debug.log('[ID Scan] Edge function:', Math.round(edgeTime), 'ms')

  const data: ExtractIDResponse | null = response.data
  const error: EdgeFunctionError | null = response.error as EdgeFunctionError | null

  debug.log('Edge Function response:', { data, error })

  onProgress?.({ stage: 'Parsing results...', progress: 80 })

  if (error) {
    debug.error('Edge Function error details:', error)
    throw new Error(error.message ?? 'Failed to process ID. Please try again.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  onProgress?.({ stage: 'Complete', progress: 100 })

  const totalTime = performance.now() - startTime
  debug.log('[ID Scan] Total time:', Math.round(totalTime), 'ms')

  return {
    name: data?.name ?? '',
    nric: data?.nric ?? '',
    dob: data?.dob ?? '',
    address: data?.address ?? '',
    addressContinue: data?.addressContinue ?? '',
    confidence: data?.confidence ?? 0,
  }
}

/**
 * Extract license start date using Claude AI via Edge Function
 */
export async function extractLicenseWithGemini(
  licenseFrontImageData: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedLicenseData> {
  if (!navigator.onLine) {
    throw new Error('No internet connection.')
  }

  onProgress?.({ stage: 'Analyzing license with AI...', progress: 10 })

  // Use cached session for faster auth check
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Please sign in to use the scanner.')
  }

  onProgress?.({ stage: 'Processing license data...', progress: 50 })

  const response = await supabase.functions.invoke<ExtractIDResponse>('extract-id', {
    body: {
      type: 'license',
      frontImage: licenseFrontImageData,
    },
  })
  const data: ExtractIDResponse | null = response.data
  const licenseError: EdgeFunctionError | null = response.error as EdgeFunctionError | null

  if (licenseError) {
    debug.error('License extraction error:', licenseError)
    return { licenseStartDate: '', confidence: 0 }
  }

  if (data?.error) {
    debug.error('License extraction error:', data.error)
    return { licenseStartDate: '', confidence: 0 }
  }

  onProgress?.({ stage: 'License data extracted', progress: 100 })

  return {
    licenseStartDate: data?.licenseStartDate ?? '',
    confidence: data?.confidence ?? 0,
  }
}
