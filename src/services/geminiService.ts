/**
 * Gemini AI Service
 * Calls Supabase Edge Function for ID/license extraction
 * API key stored in Edge Function Secrets (not client-side)
 */

import { supabase } from '@/lib/supabase';

export interface ExtractedIDData {
  name: string;
  nric: string;
  dob: string;
  address: string;
  addressContinue: string;
  confidence: number;
}

export interface ExtractedLicenseData {
  licenseStartDate: string;
  confidence: number;
}

export interface ProcessingProgress {
  stage: string;
  progress: number;
}

/**
 * Check if the service is available (user authenticated and online)
 */
export function isGeminiAvailable(): boolean {
  return navigator.onLine;
}

/**
 * Extract ID details using Gemini AI via Edge Function
 */
export async function extractIDWithGemini(
  frontImageData: string,
  backImageData: string | null = null,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedIDData> {
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  onProgress?.({ stage: 'Analyzing ID with AI...', progress: 10 });

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Please sign in to use the scanner.');
  }

  onProgress?.({ stage: 'Processing with AI...', progress: 30 });

  console.log('Calling extract-id Edge Function...');
  console.log('Front image size:', frontImageData.length, 'chars');
  console.log('Back image size:', backImageData?.length || 0, 'chars');

  const { data, error } = await supabase.functions.invoke('extract-id', {
    body: {
      type: 'id',
      frontImage: frontImageData,
      backImage: backImageData,
    },
  });

  console.log('Edge Function response:', { data, error });

  onProgress?.({ stage: 'Parsing results...', progress: 80 });

  if (error) {
    console.error('Edge Function error details:', error);
    throw new Error(error.message || 'Failed to process ID. Please try again.');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  onProgress?.({ stage: 'Complete', progress: 100 });

  return {
    name: data.name || '',
    nric: data.nric || '',
    dob: data.dob || '',
    address: data.address || '',
    addressContinue: data.addressContinue || '',
    confidence: data.confidence || 0,
  };
}

/**
 * Extract license start date using Gemini AI via Edge Function
 */
export async function extractLicenseWithGemini(
  licenseFrontImageData: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractedLicenseData> {
  if (!navigator.onLine) {
    throw new Error('No internet connection.');
  }

  onProgress?.({ stage: 'Analyzing license with AI...', progress: 10 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Please sign in to use the scanner.');
  }

  onProgress?.({ stage: 'Processing license data...', progress: 50 });

  const { data, error } = await supabase.functions.invoke('extract-id', {
    body: {
      type: 'license',
      frontImage: licenseFrontImageData,
    },
  });

  if (error) {
    console.error('License extraction error:', error);
    return { licenseStartDate: '', confidence: 0 };
  }

  if (data.error) {
    console.error('License extraction error:', data.error);
    return { licenseStartDate: '', confidence: 0 };
  }

  onProgress?.({ stage: 'License data extracted', progress: 100 });

  return {
    licenseStartDate: data.licenseStartDate || '',
    confidence: data.confidence || 0,
  };
}

// Legacy exports for backward compatibility (no longer needed but kept to avoid breaking imports)
export function loadGeminiApiKey(): Promise<string | null> {
  return Promise.resolve(null);
}

export function clearGeminiApiKeyCache(): void {
  // No-op - API key is now server-side
}
