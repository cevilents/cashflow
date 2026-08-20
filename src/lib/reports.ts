import type { Category, Transaction } from '../types/database'

export interface CategoryTotal {
  name: string
  total: number
}

export interface ReportSummary {
  income: number
  expense: number
  net: number
  rows: CategoryTotal[]
}

export function filterByMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => t.date.slice(0, 7) === month)
}

export function buildReportSummary(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): ReportSummary {
  const monthTxs = filterByMonth(transactions, month)
  const byId = new Map(categories.map((c) => [c.id, c]))

  let income = 0
  let expense = 0
  const totals = new Map<string, number>()

  for (const t of monthTxs) {
    const amount = Number(t.amount) || 0
    if (t.type === 'income') income += amount
    else if (t.type === 'expense') {
      expense += amount
      const name = t.category_id ? byId.get(t.category_id)?.name ?? 'Tanpa kategori' : 'Tanpa kategori'
      totals.set(name, (totals.get(name) ?? 0) + amount)
    }
  }

  const rows = [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)

  return { income, expense, net: income - expense, rows }
}
