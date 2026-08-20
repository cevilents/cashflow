import { describe, expect, it } from 'vitest'
import { buildMonthlySeries, buildCategoryBreakdown, recentTransactions } from './dashboard'
import type { Category, Transaction } from '../types/database'

const NOW = new Date(2026, 7, 20)

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    type: 'expense',
    category_id: null,
    amount: 0,
    to_account_id: null,
    note: '',
    date: '2026-08-01',
    receipt_url: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...partial,
  }
}

const categories: Category[] = [
  { id: 'c1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: '', color: '#ef4444', created_at: '' },
  { id: 'c2', user_id: 'user-1', name: 'Gaji', type: 'income', icon: '', color: '#10b981', created_at: '' },
]

describe('buildMonthlySeries', () => {
  it('returns six zeroed points for an empty list', () => {
    const series = buildMonthlySeries([], NOW)
    expect(series).toHaveLength(6)
    expect(series[5]).toEqual({ key: '2026-08', label: 'Aug', income: 0, expense: 0 })
    for (const p of series) {
      expect(p.income).toBe(0)
      expect(p.expense).toBe(0)
    }
  })

  it('sums income and expense within the window', () => {
    const series = buildMonthlySeries(
      [
        tx({ id: 'a', type: 'income', amount: 50000, date: '2026-08-05' }),
        tx({ id: 'b', type: 'expense', amount: 20000, date: '2026-08-10' }),
        tx({ id: 'c', type: 'expense', amount: 30000, date: '2026-07-02' }),
      ],
      NOW,
    )
    const aug = series.find((p) => p.key === '2026-08')
    const jul = series.find((p) => p.key === '2026-07')
    expect(aug).toMatchObject({ income: 50000, expense: 20000 })
    expect(jul).toMatchObject({ income: 0, expense: 30000 })
  })

  it('ignores transfers and transactions outside the window', () => {
    const series = buildMonthlySeries(
      [
        tx({ id: 't', type: 'transfer', amount: 100000, date: '2026-08-01' }),
        tx({ id: 'old', type: 'expense', amount: 99999, date: '2025-12-01' }),
      ],
      NOW,
    )
    const aug = series.find((p) => p.key === '2026-08')
    expect(aug).toMatchObject({ income: 0, expense: 0 })
    expect(series.every((p) => p.income === 0 && p.expense === 0)).toBe(true)
  })

  it('buckets transactions by their first day of month boundary', () => {
    const series = buildMonthlySeries(
      [
        tx({ id: 'a', type: 'income', amount: 1000, date: '2026-08-01' }),
        tx({ id: 'b', type: 'income', amount: 2000, date: '2026-08-31' }),
        tx({ id: 'c', type: 'income', amount: 4000, date: '2026-09-01' }),
      ],
      NOW,
    )
    const aug = series.find((p) => p.key === '2026-08')
    expect(aug?.income).toBe(3000)
  })
})

describe('buildCategoryBreakdown', () => {
  it('returns empty for no transactions', () => {
    expect(buildCategoryBreakdown([], categories, NOW)).toEqual([])
  })

  it('aggregates only current month expenses, resolved and sorted desc', () => {
    const breakdown = buildCategoryBreakdown(
      [
        tx({ id: 'a', category_id: 'c1', amount: 10000, date: '2026-08-01' }),
        tx({ id: 'b', category_id: 'c1', amount: 15000, date: '2026-08-10' }),
        tx({ id: 'c', category_id: 'c2', amount: 2000, date: '2026-08-02' }),
        tx({ id: 'd', category_id: 'c1', amount: 5000, date: '2026-07-01' }),
      ],
      categories,
      NOW,
    )
    expect(breakdown).toEqual([
      { id: 'c1', name: 'Makanan', color: '#ef4444', value: 25000 },
      { id: 'c2', name: 'Gaji', color: '#10b981', value: 2000 },
    ])
  })

  it('ignores income, transfers, and missing categories in expense mode', () => {
    const breakdown = buildCategoryBreakdown(
      [
        tx({ id: 'a', type: 'income', category_id: 'c2', amount: 99999, date: '2026-08-01' }),
        tx({ id: 'b', type: 'transfer', category_id: null, amount: 99999, date: '2026-08-01' }),
        tx({ id: 'c', category_id: null, amount: 99999, date: '2026-08-01' }),
      ],
      categories,
      NOW,
    )
    expect(breakdown).toEqual([])
  })

  it('supports income mode and caps the result to max', () => {
    const txs = Array.from({ length: 12 }, (_, i) =>
      tx({ id: `t${i}`, type: 'income', category_id: `c${i}`, amount: i + 1, date: '2026-08-01' }),
    )
    const breakdown = buildCategoryBreakdown(txs, [], NOW, 'income', 8)
    expect(breakdown).toHaveLength(8)
    expect(breakdown[0]!.value).toBe(12)
    expect(breakdown[7]!.value).toBe(5)
  })

  it('falls back to placeholder name and color for unknown categories', () => {
    const breakdown = buildCategoryBreakdown(
      [tx({ id: 'a', category_id: 'unknown', amount: 1000, date: '2026-08-01' })],
      categories,
      NOW,
    )
    expect(breakdown).toEqual([{ id: 'unknown', name: 'Lainnya', color: '#64748b', value: 1000 }])
  })
})

describe('recentTransactions', () => {
  it('sorts by date descending and limits the count', () => {
    const txs = [
      tx({ id: 'a', date: '2026-08-01' }),
      tx({ id: 'b', date: '2026-08-10' }),
      tx({ id: 'c', date: '2026-08-05' }),
      tx({ id: 'd', date: '2026-08-07' }),
    ]
    const recent = recentTransactions(txs, 2)
    expect(recent.map((t) => t.id)).toEqual(['b', 'd'])
  })

  it('returns the whole list when count exceeds length', () => {
    expect(recentTransactions([tx({ id: 'a', date: '2026-08-01' })], 5)).toHaveLength(1)
  })
})
