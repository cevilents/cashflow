import { describe, it, expect } from 'vitest'
import { formatRupiah, parseAmountInput } from './format'

describe('formatRupiah', () => {
  it('formats positive values', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000')
  })
  it('formats negative values', () => {
    expect(formatRupiah(-95000)).toBe('-Rp 95.000')
  })
  it('rounds decimals', () => {
    expect(formatRupiah(1000.7)).toBe('Rp 1.001')
  })
})

describe('parseAmountInput', () => {
  it('parses digits only', () => {
    expect(parseAmountInput('12.500')).toBe(12500)
  })
  it('returns null for empty or zero', () => {
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('0')).toBeNull()
  })
})