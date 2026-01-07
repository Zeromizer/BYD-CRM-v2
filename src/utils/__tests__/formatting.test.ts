import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencySGD,
  currencyToNumber,
  formatPercentage,
} from '../formatting'

describe('formatting utilities', () => {
  describe('formatCurrency', () => {
    it('returns empty string for null/undefined/zero values', () => {
      expect(formatCurrency(null)).toBe('')
      expect(formatCurrency(undefined)).toBe('')
      expect(formatCurrency(0)).toBe('')
    })

    it('formats numbers without decimals by default', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(1234567)).toBe('$1,234,567')
    })

    it('formats numbers with decimals when specified', () => {
      expect(formatCurrency(1000, { decimals: true })).toBe('$1,000.00')
      expect(formatCurrency(1234.5, { decimals: true })).toBe('$1,234.50')
    })

    it('respects locale option', () => {
      // Different locales may format differently
      const result = formatCurrency(1000, { locale: 'en-US' })
      expect(result).toContain('$')
      expect(result).toContain('1')
    })
  })

  describe('formatCurrencySGD', () => {
    it('returns empty string for null/undefined values', () => {
      expect(formatCurrencySGD(null)).toBe('')
      expect(formatCurrencySGD(undefined)).toBe('')
    })

    it('formats with 2 decimal places', () => {
      const result = formatCurrencySGD(1000)
      expect(result).toContain('$')
      expect(result).toContain('1,000')
      expect(result).toContain('.00')
    })
  })

  describe('currencyToNumber', () => {
    it('returns 0 for null/undefined', () => {
      expect(currencyToNumber(null)).toBe(0)
      expect(currencyToNumber(undefined)).toBe(0)
    })

    it('parses numeric strings', () => {
      expect(currencyToNumber('1234')).toBe(1234)
      expect(currencyToNumber('1234.56')).toBe(1234.56)
    })

    it('strips currency symbols and commas', () => {
      expect(currencyToNumber('$1,234.56')).toBe(1234.56)
      expect(currencyToNumber('$10,000')).toBe(10000)
    })

    it('handles negative numbers', () => {
      expect(currencyToNumber('-100')).toBe(-100)
      expect(currencyToNumber('$-500.00')).toBe(-500)
    })

    it('returns 0 for invalid input', () => {
      expect(currencyToNumber('abc')).toBe(0)
      expect(currencyToNumber('')).toBe(0)
    })

    it('passes through numbers', () => {
      expect(currencyToNumber(100)).toBe(100)
      expect(currencyToNumber(99.99)).toBe(99.99)
    })
  })

  describe('formatPercentage', () => {
    it('returns empty string for null/undefined', () => {
      expect(formatPercentage(null)).toBe('')
      expect(formatPercentage(undefined)).toBe('')
    })

    it('formats numbers with percentage symbol', () => {
      expect(formatPercentage(50)).toBe('50%')
      expect(formatPercentage(100)).toBe('100%')
      expect(formatPercentage(0)).toBe('0%')
    })

    it('handles decimal percentages', () => {
      expect(formatPercentage(12.5)).toBe('12.5%')
      expect(formatPercentage(99.99)).toBe('99.99%')
    })
  })
})
