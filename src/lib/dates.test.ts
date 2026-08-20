import { describe, it, expect } from 'vitest'
import { advanceDate, todayISO, formatDay } from './dates'

describe('advanceDate', () => {
  it('advances a week', () => {
    expect(advanceDate('2026-08-19', 'weekly')).toBe('2026-08-26')
  })
  it('advances a month', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-03-03')
  })
  it('advances a year', () => {
    expect(advanceDate('2026-08-19', 'yearly')).toBe('2027-08-19')
  })
})

describe('formatDay', () => {
  it('formats an ISO date', () => {
    expect(formatDay('2026-08-19')).toBe('19 Agu 2026')
  })
})

describe('todayISO', () => {
  it('returns the current date in ISO format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})