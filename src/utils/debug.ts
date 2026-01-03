/**
 * Debug Utility
 * Provides environment-aware logging that only outputs in development mode.
 * Use this instead of console.log for production-safe debugging.
 */

const isDev = import.meta.env.DEV;

/**
 * Debug logger - only logs in development mode
 */
export const debug = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  info: (...args: unknown[]) => isDev && console.info(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => isDev && console.error(...args),
  table: (...args: unknown[]) => isDev && console.table(...args),
  group: (label: string) => isDev && console.group(label),
  groupEnd: () => isDev && console.groupEnd(),
  time: (label: string) => isDev && console.time(label),
  timeEnd: (label: string) => isDev && console.timeEnd(label),
};

/**
 * Performance measurement utility
 * Only active in development mode
 */
export function measurePerformance<T>(name: string, fn: () => T): T {
  if (!isDev) return fn();

  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
  return result;
}

/**
 * Async performance measurement utility
 */
export async function measurePerformanceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!isDev) return fn();

  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
  return result;
}
