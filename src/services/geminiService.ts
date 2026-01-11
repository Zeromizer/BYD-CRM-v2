/**
 * Gemini AI Service
 * Calls Supabase Edge Function for ID/license extraction
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

export interface ExtractedAddressData {
  address: string
  addressContinue: string
  confidence: number
}

export interface ProcessingProgress {
  stage: string
  progress: number
}

/**
 * Check if the service is available (user authenticated and online)
 */
export function isGeminiAvailable(): boolean {
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
 * Extract ID details using Gemini AI via Edge Function
 * Note: Only processes front image. Use extractAddressFromBack for back image.
 */
export async function extractIDWithGemini(
  frontImageData: string,
  _backImageData: string | null = null, // Kept for backwards compatibility, not used
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

  debug.log('Calling extract-id Edge Function (front only)...')
  debug.log('Front image size:', frontImageData.length, 'chars')

  const edgeStart = performance.now()
  // Only send front image - back image processed separately to avoid timeout
  const response = await supabase.functions.invoke<ExtractIDResponse>('extract-id', {
    body: {
      type: 'id',
      frontImage: frontImageData,
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
 * Extract address from back of ID using Gemini AI via Edge Function
 * Separate call to avoid timeout when processing both images together
 */
export async function extractAddressFromBack(
  backImageData: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedAddressData> {
  const startTime = performance.now()

  if (!navigator.onLine) {
    throw new Error('No internet connection.')
  }

  onProgress?.({ stage: 'Extracting address...', progress: 10 })

  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Please sign in to use the scanner.')
  }

  onProgress?.({ stage: 'Processing address...', progress: 30 })

  debug.log('Calling extract-id Edge Function for back image...')
  debug.log('Back image size:', backImageData.length, 'chars')

  const edgeStart = performance.now()
  const response = await supabase.functions.invoke<ExtractedAddressData>('extract-id', {
    body: {
      type: 'id-back',
      frontImage: backImageData, // Send back image as frontImage (only image needed)
    },
  })
  const edgeTime = performance.now() - edgeStart
  debug.log('[ID Scan] Address extraction edge function:', Math.round(edgeTime), 'ms')

  const data = response.data
  const error = response.error as EdgeFunctionError | null

  debug.log('Address extraction response:', { data, error })

  onProgress?.({ stage: 'Address extracted', progress: 100 })

  if (error) {
    debug.error('Address extraction error:', error)
    throw new Error(error.message ?? 'Failed to extract address.')
  }

  if ((data as ExtractIDResponse)?.error) {
    throw new Error((data as ExtractIDResponse).error)
  }

  const totalTime = performance.now() - startTime
  debug.log('[ID Scan] Address extraction total time:', Math.round(totalTime), 'ms')

  return {
    address: data?.address ?? '',
    addressContinue: data?.addressContinue ?? '',
    confidence: data?.confidence ?? 0,
  }
}

/**
 * Extract license start date using Gemini AI via Edge Function
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

// Legacy exports for backward compatibility (no longer needed but kept to avoid breaking imports)
export function loadGeminiApiKey(): Promise<string | null> {
  return Promise.resolve(null)
}

export function clearGeminiApiKeyCache(): void {
  // No-op - API key is now server-side
}
