import { describe, expect, it } from 'vitest'
import { filterByMonth, buildReportSummary } from './reports'
import type { Category, Transaction } from '../types/database'

const tx = (partial: Partial<Transaction>): Transaction => ({
  id: partial.id ?? 't',
  user_id: 'u',
  account_id: partial.account_id ?? 'a',
  type: partial.type ?? 'expense',
  category_id: partial.category_id ?? null,
  amount: partial.amount ?? 0,
  to_account_id: null,
  note: '',
  date: partial.date ?? '2026-08-01',
  receipt_url: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
})

const categories: Category[] = [
  { id: 'c1', user_id: 'u', name: 'Makanan', type: 'expense', icon: '', color: '#f43f5e', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', user_id: 'u', name: 'Gaji', type: 'income', icon: '', color: '#10b981', created_at: '2026-01-01T00:00:00Z' },
]

describe('filterByMonth', () => {
  it('keeps only transactions in the given month', () => {
    const list = [
      tx({ id: '1', date: '2026-08-05' }),
      tx({ id: '2', date: '2026-07-31' }),
      tx({ id: '3', date: '2026-08-31' }),
    ]
    expect(filterByMonth(list, '2026-08').map((t) => t.id)).toEqual(['1', '3'])
  })

  it('returns empty when nothing matches', () => {
    expect(filterByMonth([tx({ id: '1', date: '2026-01-01' })], '2026-12')).toEqual([])
  })
})

describe('buildReportSummary', () => {
  it('sums income and expense for the month only and ignores other months', () => {
    const list = [
      tx({ id: '1', type: 'income', amount: 100000, date: '2026-08-01' }),
      tx({ id: '2', type: 'expense', amount: 25000, category_id: 'c1', date: '2026-08-02' }),
      tx({ id: '3', type: 'expense', amount: 90000, category_id: 'c1', date: '2026-07-31' }),
    ]
    const s = buildReportSummary(list, categories, '2026-08')
    expect(s.income).toBe(100000)
    expect(s.expense).toBe(25000)
    expect(s.net).toBe(75000)
    expect(s.rows).toEqual([{ name: 'Makanan', total: 25000 }])
  })

  it('labels expenses without a category as Tanpa kategori', () => {
    const s = buildReportSummary([tx({ id: '1', type: 'expense', amount: 5000, category_id: null, date: '2026-08-01' })], [], '2026-08')
    expect(s.rows).toEqual([{ name: 'Tanpa kategori', total: 5000 }])
  })

  it('labels expenses with a missing category as Tanpa kategori', () => {
    const s = buildReportSummary([tx({ id: '1', type: 'expense', amount: 5000, category_id: 'ghost', date: '2026-08-01' })], categories, '2026-08')
    expect(s.rows).toEqual([{ name: 'Tanpa kategori', total: 5000 }])
  })

  it('sorts category rows by total descending', () => {
    const list = [
      tx({ id: '1', type: 'expense', amount: 1000, category_id: 'c1', date: '2026-08-01' }),
      tx({ id: '2', type: 'expense', amount: 9000, category_id: 'c1', date: '2026-08-02' }),
    ]
    const s = buildReportSummary(list, categories, '2026-08')
    expect(s.rows).toEqual([{ name: 'Makanan', total: 10000 }])
  })

  it('ignores transfers in summary and returns empty rows with no expenses', () => {
    const s = buildReportSummary([tx({ id: '1', type: 'transfer', amount: 3000, date: '2026-08-01' })], categories, '2026-08')
    expect(s.income).toBe(0)
    expect(s.expense).toBe(0)
    expect(s.rows).toEqual([])
  })

  it('returns zeroed summary for empty transactions', () => {
    const s = buildReportSummary([], categories, '2026-08')
    expect(s).toEqual({ income: 0, expense: 0, net: 0, rows: [] })
  })
})
