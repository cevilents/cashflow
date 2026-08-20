import { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { formatRupiah } from '../../lib/format'
import { formatDay } from '../../lib/dates'
import type { Account, Category, Transaction } from '../../types/database'
import { Button } from '../ui/Button'
import { ReceiptLightbox } from '../receipt/ReceiptLightbox'
import { useReadOnly } from '../../hooks/useReadOnly'
import { useMembers } from '../../hooks/useMembers'
import { getMemberById } from '../../lib/members'

const typeMeta = {
  income: { icon: ArrowUpRight, label: 'Pemasukan', cls: 'text-good' },
  expense: { icon: ArrowDownRight, label: 'Pengeluaran', cls: 'text-bad' },
  transfer: { icon: ArrowLeftRight, label: 'Transfer', cls: 'text-move' },
}

export function TransactionRow({
  tx,
  account,
  category,
  toAccount,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  account?: Account
  category?: Category | null
  toAccount?: Account
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  const [showReceipt, setShowReceipt] = useState(false)
  const meta = typeMeta[tx.type]
  const Icon = meta.icon
  const readOnly = useReadOnly(tx.user_id)
  const { data: members } = useMembers()
  const owner = getMemberById(tx.user_id, members ?? [])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft">
        <Icon className={`h-5 w-5 ${meta.cls}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {tx.type === 'transfer'
            ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
            : category?.name ?? (tx.note || meta.label)}
        </p>
        <p className="flex items-center gap-2 truncate text-xs text-ink-muted">
          {owner && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: owner.color }} />
              {owner.name}
            </span>
          )}
          <span>{account?.name}</span>
          <span>·</span>
          <span>{formatDay(tx.date)}</span>
          {tx.receipt_url && (
            <button onClick={() => setShowReceipt(true)} className="flex items-center gap-1 text-move hover:underline" aria-label="Lihat bukti">
              <Paperclip className="h-3.5 w-3.5" /> bukti
            </button>
          )}
        </p>
      </div>
      <div className={`tabular text-sm font-semibold ${meta.cls}`}>
        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}{formatRupiah(tx.amount)}
      </div>
      {!readOnly && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(tx)} aria-label="Ubah">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(tx)} aria-label="Hapus" className="text-bad">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      {showReceipt && tx.receipt_url && <ReceiptLightbox path={tx.receipt_url} onClose={() => setShowReceipt(false)} />}
    </div>
  )
}
