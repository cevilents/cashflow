import { Search } from 'lucide-react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { Account, Category } from '../../types/database'

export interface TxFiltersValue {
  search: string
  type: string
  accountId: string
  categoryId: string
  from: string
  to: string
}

export const emptyFilters: TxFiltersValue = { search: '', type: '', accountId: '', categoryId: '', from: '', to: '' }

export function TransactionFilters({
  value,
  onChange,
  accounts,
  categories,
}: {
  value: TxFiltersValue
  onChange: (v: TxFiltersValue) => void
  accounts: Account[]
  categories: Category[]
}) {
  const set = (patch: Partial<TxFiltersValue>) => onChange({ ...value, ...patch })
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div className="relative col-span-2">
        <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-ink-muted" />
        <Input className="pl-9" placeholder="Cari catatan…" value={value.search} onChange={(e) => set({ search: e.target.value })} aria-label="Cari" />
      </div>
      <Select value={value.type} onChange={(e) => set({ type: e.target.value })} aria-label="Tipe transaksi">
        <option value="">Semua tipe</option>
        <option value="income">Pemasukan</option>
        <option value="expense">Pengeluaran</option>
        <option value="transfer">Transfer</option>
      </Select>
      <Select value={value.accountId} onChange={(e) => set({ accountId: e.target.value })} aria-label="Akun">
        <option value="">Semua akun</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </Select>
      <Select value={value.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Kategori">
        <option value="">Semua kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} aria-label="Dari tanggal" className="!px-2" />
        <Input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} aria-label="Sampai tanggal" className="!px-2" />
      </div>
    </div>
  )
}
