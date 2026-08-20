import { SearchX } from 'lucide-react'
import { TransactionRow } from './TransactionRow'
import { EmptyState } from '../ui/EmptyState'
import type { Account, Category, Transaction } from '../../types/database'

export function TransactionList({
  transactions,
  accountsById,
  categoriesById,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[]
  accountsById: Record<string, Account>
  categoriesById: Record<string, Category>
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  if (transactions.length === 0) {
    return <EmptyState icon={<SearchX className="h-10 w-10" />} title="Tidak ada transaksi" message="Coba ubah filter atau tambah transaksi baru." />
  }
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          account={accountsById[tx.account_id]}
          category={tx.category_id ? categoriesById[tx.category_id] : null}
          toAccount={tx.to_account_id ? accountsById[tx.to_account_id] : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
