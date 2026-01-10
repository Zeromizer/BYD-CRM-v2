import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleSupabaseError,
  createTimeoutPromise,
  withTimeout,
  withRetry,
  isNetworkError,
  checkNetworkAvailability,
  delay,
  processBatch,
} from '../errorHandler'

describe('errorHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleSupabaseError', () => {
    it('throws with error message from Error object', () => {
      const error = new Error('Database connection failed')
      expect(() => handleSupabaseError(error, 'testOperation')).toThrow(
        'Database connection failed'
      )
    })

    it('throws with string error', () => {
      expect(() => handleSupabaseError('Something went wrong', 'testOperation')).toThrow(
        'Something went wrong'
      )
    })

    it('includes context in fallback message when error is empty', () => {
      expect(() => handleSupabaseError('', 'fetchCustomers')).toThrow(
        'Operation failed: fetchCustomers'
      )
    })
  })

  describe('createTimeoutPromise', () => {
    it('rejects after specified timeout', async () => {
      const promise = createTimeoutPromise(1000, 'testOperation')
      vi.advanceTimersByTime(1000)
      await expect(promise).rejects.toThrow('testOperation timed out after 1000ms')
    })
  })

  describe('withTimeout', () => {
    it('resolves if promise completes before timeout', async () => {
      const fastPromise = Promise.resolve('success')
      const result = await withTimeout(fastPromise, 1000, 'fastOp')
      expect(result).toBe('success')
    })

    it('rejects if promise takes longer than timeout', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 2000)
      })
      const timeoutPromise = withTimeout(slowPromise, 1000, 'slowOp')
      vi.advanceTimersByTime(1000)
      await expect(timeoutPromise).rejects.toThrow('slowOp timed out after 1000ms')
    })
  })

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn, { maxAttempts: 3 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and succeeds', async () => {
      vi.useRealTimers() // Need real timers for retry delays
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('success')
      const result = await withRetry(fn, { maxAttempts: 3, backoffMs: 10 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws after max attempts', async () => {
      vi.useRealTimers()
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))
      await expect(withRetry(fn, { maxAttempts: 2, backoffMs: 10 })).rejects.toThrow('always fails')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('respects shouldRetry callback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('non-retryable'))
      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('non-retryable')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('isNetworkError', () => {
    it('returns true for network-related errors', () => {
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
      expect(isNetworkError(new Error('network error occurred'))).toBe(true)
      expect(isNetworkError(new Error('fetch failed'))).toBe(true)
    })

    it('returns false for non-network errors', () => {
      expect(isNetworkError(new Error('Database error'))).toBe(false)
      expect(isNetworkError(new Error('Invalid input'))).toBe(false)
      expect(isNetworkError('string error')).toBe(false)
    })
  })

  describe('checkNetworkAvailability', () => {
    const originalNavigator = global.navigator

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      })
    })

    it('does not throw when online', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
      })
      expect(() => checkNetworkAvailability()).not.toThrow()
    })

    it('throws when offline', () => {
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
      })
      expect(() => checkNetworkAvailability()).toThrow('No internet connection')
    })
  })

  describe('delay', () => {
    it('resolves after specified time', async () => {
      const promise = delay(1000)
      vi.advanceTimersByTime(1000)
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('processBatch', () => {
    it('processes all items', async () => {
      vi.useRealTimers()
      const items = [1, 2, 3, 4, 5]
      const processor = vi.fn((item: number) => Promise.resolve(item * 2))
      const results = await processBatch(items, processor, { concurrency: 2, delayMs: 10 })
      expect(results).toEqual([2, 4, 6, 8, 10])
      expect(processor).toHaveBeenCalledTimes(5)
    })

    it('calls onProgress with correct values', async () => {
      vi.useRealTimers()
      const items = [1, 2, 3, 4]
      const processor = (item: number) => Promise.resolve(item)
      const onProgress = vi.fn()
      await processBatch(items, processor, { concurrency: 2, delayMs: 10, onProgress })
      expect(onProgress).toHaveBeenCalledWith(2, 4)
      expect(onProgress).toHaveBeenCalledWith(4, 4)
    })
  })
})
