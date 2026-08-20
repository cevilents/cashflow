import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTransactions, useDeleteTransaction } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { TransactionList } from '../components/transaction/TransactionList'
import { TransactionFilters, emptyFilters } from '../components/transaction/TransactionFilters'
import type { TxFiltersValue } from '../components/transaction/TransactionFilters'
import { TransactionForm } from '../components/transaction/TransactionForm'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { formatRupiah } from '../lib/format'
import type { Transaction } from '../types/database'

export default function TransactionsPage() {
  const { data: transactions, isLoading, isError, refetch } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const deleteTx = useDeleteTransaction()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [filters, setFilters] = useState<TxFiltersValue>(emptyFilters)

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(null)
      setFormOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const list = transactions ?? []
    const q = filters.search.toLowerCase().trim()
    return list.filter((t) => {
      if (filters.type && t.type !== filters.type) return false
      if (filters.accountId && t.account_id !== filters.accountId && t.to_account_id !== filters.accountId) return false
      if (filters.categoryId && t.category_id !== filters.categoryId) return false
      if (filters.from && t.date < filters.from) return false
      if (filters.to && t.date > filters.to) return false
      if (q) {
        const accName = accountsById[t.account_id]?.name.toLowerCase() ?? ''
        const catName = t.category_id ? categoriesById[t.category_id]?.name.toLowerCase() ?? '' : ''
        const note = t.note.toLowerCase()
        if (!accName.includes(q) && !catName.includes(q) && !note.includes(q)) return false
      }
      return true
    })
  }, [transactions, filters, accountsById, categoriesById])

  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    let transfer = 0
    for (const t of filtered) {
      const amount = Number(t.amount) || 0
      if (t.type === 'income') income += amount
      else if (t.type === 'expense') expense += amount
      else transfer += amount
    }
    return { income, expense, transfer }
  }, [filtered])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing({ ...t })
    setFormOpen(true)
  }
  const confirmDelete = async () => {
    if (!deleting || deleteTx.isPending) return
    try {
      await deleteTx.mutateAsync(deleting.id)
      toast('Transaksi dihapus')
      setDeleting(null)
    } catch {
      toast('Gagal menghapus transaksi', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Gagal memuat transaksi"
        message="Terjadi masalah saat mengambil data transaksi."
        action={<Button variant="secondary" onClick={() => refetch()}>Muat Ulang</Button>}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Transaksi</h1>
          <p className="text-sm text-ink-muted">Catat pemasukan, pengeluaran, dan transfer</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <TransactionFilters value={filters} onChange={setFilters} accounts={accounts ?? []} categories={categories ?? []} />

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border-subtle bg-surface-card px-4 py-3">
            <p className="text-xs text-ink-muted">Pemasukan</p>
            <p className="mt-1 text-base font-bold text-good tabular">{formatRupiah(summary.income)}</p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-card px-4 py-3">
            <p className="text-xs text-ink-muted">Pengeluaran</p>
            <p className="mt-1 text-base font-bold text-bad tabular">{formatRupiah(summary.expense)}</p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-card px-4 py-3">
            <p className="text-xs text-ink-muted">Transfer</p>
            <p className="mt-1 text-base font-bold text-move tabular">{formatRupiah(summary.transfer)}</p>
          </div>
        </div>
      )}

      <TransactionList
        transactions={filtered}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      <TransactionForm
        key={editing?.id ?? 'create'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus transaksi?"
        message="Transaksi ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        loading={deleteTx.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
