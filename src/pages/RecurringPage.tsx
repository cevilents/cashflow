import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, CheckCircle2, Circle } from 'lucide-react'
import { useRecurring, useCreateRecurring, useUpdateRecurring, useDeleteRecurring } from '../hooks/useRecurring'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCreateTransaction } from '../hooks/useTransactions'
import { useMembers } from '../hooks/useMembers'
import { useReadOnly, useCurrentMember } from '../hooks/useReadOnly'
import { getMemberById } from '../lib/members'
import type { Member } from '../lib/members'
import { MemberFilter } from '../components/layout/MemberFilter'
import type { OwnerFilter } from '../components/layout/MemberFilter'
import { formatRupiah } from '../lib/format'
import { advanceDate, formatDay, todayISO } from '../lib/dates'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import type { Frequency, RecurringTransaction, Account, Category } from '../types/database'

const frequencyLabels: Record<Frequency, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
}

export function RecurringForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: RecurringTransaction | null
}) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createRec = useCreateRecurring()
  const updateRec = useUpdateRecurring()
  const { toast } = useToast()

  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<'income' | 'expense'>(editing?.type ?? 'expense')
  const [accountId, setAccountId] = useState(editing?.account_id ?? '')
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '')
  const [amountRaw, setAmountRaw] = useState(editing ? String(editing.amount) : '')
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? 'monthly')
  const [nextDue, setNextDue] = useState(editing?.next_due_date ?? todayISO())
  const [saving, setSaving] = useState(false)

  const active = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])
  const typeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === type),
    [categories, type],
  )

  const onTypeChange = (t: 'income' | 'expense') => {
    setType(t)
    setCategoryId((prev) =>
      (categories ?? []).some((c) => c.id === prev && c.type === t) ? prev : '',
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(amountRaw.replace(/[^\d]/g, ''))
    const validCategory = typeCategories.some((c) => c.id === categoryId)
    if (!name.trim()) {
      toast('Nama wajib diisi', 'error')
      return
    }
    if (!accountId) {
      toast('Pilih akun', 'error')
      return
    }
    if (!validCategory) {
      toast('Pilih kategori', 'error')
      return
    }
    if (!(amount > 0)) {
      toast('Jumlah harus lebih dari 0', 'error')
      return
    }
    if (!nextDue) {
      toast('Tanggal jatuh tempo wajib diisi', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        account_id: accountId,
        category_id: categoryId,
        amount,
        frequency,
        next_due_date: nextDue,
        is_active: true,
      }
      if (editing) {
        await updateRec.mutateAsync({ id: editing.id, ...payload })
        toast('Transaksi berulang diperbarui')
      } else {
        await createRec.mutateAsync(payload)
        toast('Transaksi berulang ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Listrik bulanan" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipe" value={type} onChange={(e) => onTypeChange(e.target.value as 'income' | 'expense')}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </Select>
          <Select label="Frekuensi" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </Select>
        </div>
        <Select label="Akun" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Pilih akun…</option>
          {active.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Pilih kategori…</option>
          {typeCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
        <Input label="Jatuh tempo berikutnya" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

interface RecurringItemProps {
  r: RecurringTransaction
  idle: boolean
  accountsById: Record<string, Account>
  categoriesById: Record<string, Category>
  members: Member[]
  recording: boolean
  updatePending: boolean
  onToggle: (r: RecurringTransaction) => void
  onRecordNow: (r: RecurringTransaction) => void
  onEdit: (r: RecurringTransaction) => void
  onDelete: (r: RecurringTransaction) => void
}

function RecurringItem({ r, idle, accountsById, categoriesById, members, recording, updatePending, onToggle, onRecordNow, onEdit, onDelete }: RecurringItemProps) {
  const readOnly = useReadOnly(r.user_id)
  const owner = getMemberById(r.user_id, members)

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border-subtle px-4 py-3 ${idle ? 'bg-surface-card/50 opacity-70' : 'bg-surface-card'}`}>
      {!readOnly && (
        <button
          onClick={() => onToggle(r)}
          aria-label={idle ? 'Aktifkan' : 'Nonaktifkan'}
          className={`shrink-0 ${idle ? 'text-ink-muted' : 'text-good'}`}
          disabled={updatePending}
        >
          {idle ? <Circle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-medium text-ink ${idle ? 'line-through' : ''}`}>{r.name}</p>
          {owner && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: owner.color }} />
              {owner.name}
            </span>
          )}
          <Badge tone={r.type === 'income' ? 'good' : 'bad'}>
            {r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          {accountsById[r.account_id]?.name ?? '?'}
          {categoriesById[r.category_id ?? ''] ? ` · ${categoriesById[r.category_id ?? '']?.name}` : ''}
          {' · '}
          {frequencyLabels[r.frequency]}
          {idle ? ' · nonaktif' : ''}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold tabular ${r.type === 'expense' ? 'text-bad' : 'text-good'}`}>
          {r.type === 'expense' ? '-' : '+'}{formatRupiah(Number(r.amount))}
        </p>
        <p className="text-xs text-ink-muted">Jatuh tempo {formatDay(r.next_due_date)}</p>
      </div>
      {!readOnly && (
        <div className="flex shrink-0 gap-1">
          {!idle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRecordNow(r)}
              disabled={recording}
              aria-label="Catat sekarang"
            >
              <CalendarClock className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(r)} aria-label="Ubah">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(r)} aria-label="Hapus" className="text-bad">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default function RecurringPage() {
  const { data: recurring, isLoading } = useRecurring()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: members } = useMembers()
  const currentMember = useCurrentMember()
  const createTx = useCreateTransaction()
  const updateRec = useUpdateRecurring()
  const deleteRec = useDeleteRecurring()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [formSeq, setFormSeq] = useState(0)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null)
  const [recording, setRecording] = useState<string | null>(null)
  const [owner, setOwner] = useState<OwnerFilter>('all')

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  const toggleActive = async (r: RecurringTransaction) => {
    if (updateRec.isPending) return
    try {
      await updateRec.mutateAsync({ id: r.id, is_active: !r.is_active })
      toast(r.is_active ? 'Transaksi berulang dinonaktifkan' : 'Transaksi berulang diaktifkan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengubah status', 'error')
    }
  }

  const recordNow = async (r: RecurringTransaction) => {
    if (recording) return
    setRecording(r.id)
    try {
      await createTx.mutateAsync({
        account_id: r.account_id,
        type: r.type,
        category_id: r.category_id,
        amount: Number(r.amount),
        to_account_id: null,
        note: r.name,
        date: todayISO(),
        receipt_url: null,
      })
      await updateRec.mutateAsync({ id: r.id, next_due_date: advanceDate(r.next_due_date, r.frequency) })
      toast('Dicatat hari ini, jatuh tempo digeser')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mencatat transaksi', 'error')
    } finally {
      setRecording(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting || deleteRec.isPending) return
    try {
      await deleteRec.mutateAsync(deleting.id)
      toast('Transaksi berulang dihapus')
      setDeleting(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus transaksi berulang', 'error')
      setDeleting(null)
    }
  }

  const openForm = (r: RecurringTransaction | null) => {
    setEditing(r)
    setFormSeq((s) => s + 1)
    setFormOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const canManage = owner === 'all' || owner === currentMember?.id

  const activeItems = (recurring ?? []).filter((r) => r.is_active && (owner === 'all' || r.user_id === owner))
  const idleItems = (recurring ?? []).filter((r) => !r.is_active && (owner === 'all' || r.user_id === owner))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Transaksi Berulang</h1>
          <p className="text-sm text-ink-muted">Tagihan dan pemasukan terjadwal</p>
        </div>
        {canManage && (
          <Button onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        )}
      </div>

      <MemberFilter value={owner} onChange={setOwner} />

      <div className="space-y-2">
        {activeItems.length === 0 && idleItems.length === 0 && (
          <EmptyState
            title="Belum ada transaksi berulang"
            message="Tambahkan tagihan bulanan seperti listrik atau internet."
          />
        )}
        {activeItems.map((r) => (
          <RecurringItem
            key={r.id}
            r={r}
            idle={false}
            accountsById={accountsById}
            categoriesById={categoriesById}
            members={members ?? []}
            recording={recording === r.id}
            updatePending={updateRec.isPending}
            onToggle={toggleActive}
            onRecordNow={recordNow}
            onEdit={openForm}
            onDelete={setDeleting}
          />
        ))}
        {idleItems.map((r) => (
          <RecurringItem
            key={r.id}
            r={r}
            idle
            accountsById={accountsById}
            categoriesById={categoriesById}
            members={members ?? []}
            recording={recording === r.id}
            updatePending={updateRec.isPending}
            onToggle={toggleActive}
            onRecordNow={recordNow}
            onEdit={openForm}
            onDelete={setDeleting}
          />
        ))}
      </div>

      <RecurringForm key={formSeq} open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus transaksi berulang?"
        message="Jadwal ini akan dihapus. Transaksi yang sudah tercatat tidak terpengaruh."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteRec.isPending}
      />
    </div>
  )
}
