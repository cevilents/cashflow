import { format, subMonths } from 'date-fns'
import { monthLabel } from './dates'
import type { Category, Transaction } from '../types/database'

export interface MonthPoint {
  key: string
  label: string
  income: number
  expense: number
}

export interface CategorySlice {
  id: string
  name: string
  color: string
  value: number
}

export function buildMonthlySeries(
  transactions: Transaction[],
  now: Date = new Date(),
  monthCount = 6,
): MonthPoint[] {
  const points: MonthPoint[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const m = subMonths(now, i)
    points.push({ key: format(m, 'yyyy-MM'), label: monthLabel(m), income: 0, expense: 0 })
  }
  const map = new Map(points.map((p) => [p.key, p]))
  for (const t of transactions) {
    const bucket = map.get(t.date.slice(0, 7))
    if (!bucket) continue
    const amount = Number(t.amount) || 0
    if (t.type === 'income') bucket.income += amount
    else if (t.type === 'expense') bucket.expense += amount
  }
  return points
}

export function buildCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  now: Date = new Date(),
  type: 'expense' | 'income' = 'expense',
  max = 8,
): CategorySlice[] {
  const currentKey = format(now, 'yyyy-MM')
  const byId = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== type || !t.category_id) continue
    if (t.date.slice(0, 7) !== currentKey) continue
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + (Number(t.amount) || 0))
  }
  return [...totals.entries()]
    .map(([id, value]) => ({
      id,
      value,
      name: byId.get(id)?.name ?? 'Lainnya',
      color: byId.get(id)?.color ?? '#64748b',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
}

export function recentTransactions(transactions: Transaction[], count = 5): Transaction[] {
  return [...transactions]
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
      }
      return a.date < b.date ? 1 : -1
    })
    .slice(0, count)
}
