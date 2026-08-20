import type { Account, Category, Transaction } from '../types/database'
import type { Member } from './members'
import { getMemberById } from './members'

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const REPORT_HEADER: string[] = [
  'Tanggal',
  'Tipe',
  'Akun',
  'Kategori',
  'Jumlah',
  'Catatan',
  'Pemilik',
]

export function buildReportRows(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  month: string,
  members: Member[],
): (string | number)[][] {
  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  return transactions
    .filter((t) => t.date.slice(0, 7) === month)
    .map((t) => [
      t.date,
      t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
      accountsById.get(t.account_id)?.name ?? '',
      t.category_id ? categoriesById.get(t.category_id)?.name ?? '' : '',
      t.type === 'income' ? Number(t.amount) : -Number(t.amount),
      t.note,
      getMemberById(t.user_id, members)?.name ?? '',
    ])
}
