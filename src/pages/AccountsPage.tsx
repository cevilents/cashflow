import { useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, Pencil, Archive, Trash2 } from 'lucide-react'
import { useAccounts, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useMembers } from '../hooks/useMembers'
import { useReadOnly, useCurrentMember } from '../hooks/useReadOnly'
import { computeAccountBalances, totalBalance } from '../lib/balances'
import { formatRupiah } from '../lib/format'
import { getMemberById } from '../lib/members'
import type { Member } from '../lib/members'
import { AccountForm } from '../components/account/AccountForm'
import { TransferModal } from '../components/account/TransferModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { MemberFilter } from '../components/layout/MemberFilter'
import type { OwnerFilter } from '../components/layout/MemberFilter'
import { accountTypeLabels } from '../lib/labels'
import type { Account } from '../types/database'

interface AccountCardProps {
  account: Account
  balances: Record<string, number>
  txCount: number
  members: Member[]
  onEdit: (a: Account) => void
  onToggleArchive: (a: Account) => void
  onDelete: (a: Account) => void
}

function AccountCard({ account, balances, txCount, members, onEdit, onToggleArchive, onDelete }: AccountCardProps) {
  const readOnly = useReadOnly(account.user_id)
  const member = getMemberById(account.user_id, members)

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: account.color }} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{account.name}</h3>
        {member && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: member.color }} />
            {member.name}
          </span>
        )}
        <span className="shrink-0 text-xs text-ink-muted">{accountTypeLabels[account.type]}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-ink tabular">{formatRupiah(balances[account.id] ?? 0)}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-muted">{txCount} transaksi</span>
        {!readOnly && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(account)} aria-label="Ubah">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onToggleArchive(account)} aria-label={account.is_archived ? 'Aktifkan' : 'Arsipkan'}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(account)} aria-label="Hapus" className="text-bad">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const { data: transactions } = useTransactions()
  const { data: members } = useMembers()
  const currentMember = useCurrentMember()
  const deleteAcc = useDeleteAccount()
  const archiveAcc = useUpdateAccount()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [owner, setOwner] = useState<OwnerFilter>('all')

  const balances = useMemo(
    () => computeAccountBalances(accounts ?? [], transactions ?? []),
    [accounts, transactions],
  )

  const total = useMemo(() => totalBalance(balances), [balances])

  const txCountByAccount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of transactions ?? []) {
      counts[t.account_id] = (counts[t.account_id] ?? 0) + 1
      if (t.to_account_id) counts[t.to_account_id] = (counts[t.to_account_id] ?? 0) + 1
    }
    return counts
  }, [transactions])

  const list = (accounts ?? []).filter((a) => !a.is_archived && (owner === 'all' || a.user_id === owner))
  const archived = (accounts ?? []).filter((a) => a.is_archived && (owner === 'all' || a.user_id === owner))

  const openEdit = (a: Account) => {
    setEditing(a)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if ((txCountByAccount[deleting.id] ?? 0) > 0) {
      toast('Akun ini punya transaksi — arsipkan saja, tidak bisa dihapus', 'error')
      setDeleting(null)
      return
    }
    try {
      await deleteAcc.mutateAsync(deleting.id)
      toast('Akun dihapus')
      setDeleting(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus akun', 'error')
      setDeleting(null)
    }
  }

  const toggleArchive = async (a: Account) => {
    try {
      await archiveAcc.mutateAsync({ id: a.id, is_archived: !a.is_archived })
      toast(a.is_archived ? 'Akun diaktifkan kembali' : 'Akun diarsipkan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengarsipkan akun', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const canManage = owner === 'all' || owner === currentMember?.id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Akun</h1>
          <p className="text-sm text-ink-muted">Sumber dana dan transfer antar akun</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="h-4 w-4" /> Transfer
              </Button>
              <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4" /> Tambah Akun
              </Button>
            </>
          )}
        </div>
      </div>

      <MemberFilter value={owner} onChange={setOwner} />

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <span className="text-xs font-medium text-ink-muted">Total saldo</span>
        <p className="mt-1 text-3xl font-bold text-ink tabular">{formatRupiah(total)}</p>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Belum ada akun" message="Buat akun pertama (tunai, bank, atau e-wallet) untuk mulai mencatat." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              balances={balances}
              txCount={txCountByAccount[a.id] ?? 0}
              members={members ?? []}
              onEdit={openEdit}
              onToggleArchive={toggleArchive}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">Diarsipkan</h2>
          <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                balances={balances}
                txCount={txCountByAccount[a.id] ?? 0}
                members={members ?? []}
                onEdit={openEdit}
                onToggleArchive={toggleArchive}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </div>
      )}

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus akun?"
        message="Akun yang punya transaksi tidak bisa dihapus dan harus diarsipkan."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
