/**
 * Centralized configuration for all services
 * Consolidates timeout values, batching settings, and retry logic
 */

export const SERVICE_CONFIG = {
  /**
   * Timeout values (in milliseconds) for different operations
   */
  timeouts: {
    /** OCR processing timeout */
    ocr: 30000,
    /** Document classification timeout */
    classification: 20000,
    /** Single file upload timeout */
    upload: 60000,
    /** Supabase Edge Function call timeout */
    edgeFunction: 30000,
    /** Signed URL request timeout */
    signedUrl: 10000,
  },

  /**
   * Batch processing configuration
   */
  batching: {
    /** Number of concurrent operations */
    concurrency: 4,
    /** Delay between batches (ms) */
    delayMs: 300,
    /** Delay between API calls for rate limiting */
    apiDelayMs: 200,
  },

  /**
   * Retry configuration for failed operations
   */
  retries: {
    /** Maximum number of retry attempts */
    maxAttempts: 3,
    /** Initial backoff delay (ms) - doubles each retry */
    backoffMs: 1000,
  },

  /**
   * Cache configuration
   */
  cache: {
    /** Signed URL cache duration (ms) - 6 hours */
    signedUrlTtl: 6 * 60 * 60 * 1000,
    /** Document list cache duration (ms) - 2 minutes */
    documentListTtl: 2 * 60 * 1000,
  },
} as const;

// Type exports for type-safe access
export type ServiceConfig = typeof SERVICE_CONFIG;
export type TimeoutConfig = typeof SERVICE_CONFIG.timeouts;
export type BatchingConfig = typeof SERVICE_CONFIG.batching;
