/**
 * Centralized error handling utilities for services
 */

import { SERVICE_CONFIG } from '@/config/serviceConfig';

/**
 * Handles Supabase errors with consistent logging and error transformation
 * @param error - The error from Supabase
 * @param context - Operation context for logging (e.g., 'uploadDocument', 'fetchCustomers')
 * @throws Always throws with a user-friendly message
 */
export function handleSupabaseError(error: unknown, context: string): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] Supabase error:`, error);
  throw new Error(errorMessage || `Operation failed: ${context}`);
}

/**
 * Creates a timeout promise that rejects after the specified duration
 * @param ms - Timeout duration in milliseconds
 * @param operation - Name of the operation for error message
 * @returns A promise that rejects with a timeout error
 */
export function createTimeoutPromise(ms: number, operation: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout duration in milliseconds
 * @param operationName - Name of the operation for error message
 * @returns The result of the promise or throws timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([promise, createTimeoutPromise(timeoutMs, operationName)]);
}

/**
 * Executes a function with retry logic and exponential backoff
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoffMs?: number;
    operationName?: string;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = SERVICE_CONFIG.retries.maxAttempts,
    backoffMs = SERVICE_CONFIG.retries.backoffMs,
    operationName = 'Operation',
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        break;
      }

      const delay = backoffMs * Math.pow(2, attempt - 1);
      console.warn(
        `[${operationName}] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError'
    );
  }
  return false;
}

/**
 * Checks if the browser is online
 */
export function checkNetworkAvailability(): void {
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }
}

/**
 * Creates a delay promise for rate limiting
 * @param ms - Delay duration in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Processes items in batches with rate limiting
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Batch processing options
 * @returns Array of results
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const {
    concurrency = SERVICE_CONFIG.batching.concurrency,
    delayMs = SERVICE_CONFIG.batching.delayMs,
    onProgress,
  } = options;

  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processor(item, i + batchIndex))
    );
    results.push(...batchResults);

    completed += batch.length;
    onProgress?.(completed, items.length);

    // Add delay between batches (but not after the last batch)
    if (i + concurrency < items.length) {
      await delay(delayMs);
    }
  }

  return results;
}
