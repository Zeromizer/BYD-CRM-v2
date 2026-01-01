/**
 * Formatting Utilities
 *
 * Shared formatting functions for currency, percentages, and other display values.
 */

/**
 * Format number as currency string (USD/SGD style)
 * @param value - Number to format
 * @param options - Formatting options
 * @returns Formatted currency string or empty string if no value
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { decimals?: boolean; locale?: string } = {}
): string {
  if (value === null || value === undefined || value === 0) return '';

  const { decimals = false, locale = 'en-US' } = options;

  if (decimals) {
    return `$${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `$${value.toLocaleString(locale)}`;
}

/**
 * Format number as SGD currency with 2 decimal places
 * Convenience wrapper for Singapore dollar formatting
 */
export function formatCurrencySGD(value: number | null | undefined): string {
  return formatCurrency(value, { decimals: true, locale: 'en-SG' });
}

/**
 * Parse currency string to number
 * @param value - Currency string or number
 * @returns Parsed number or 0 if invalid
 */
export function currencyToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const numericValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Format percentage value
 * @param value - Number to format as percentage
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return `${value}%`;
}
