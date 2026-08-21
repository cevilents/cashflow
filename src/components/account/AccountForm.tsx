import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useCreateAccount, useUpdateAccount } from '../../hooks/useAccounts'
import { parseAmountInput } from '../../lib/format'
import { accountTypeLabels } from '../../lib/labels'
import type { Account, AccountType } from '../../types/database'

export function AccountForm({
  open,
  onClose,
  editing,
  lockType,
}: {
  open: boolean
  onClose: () => void
  editing?: Account | null
  lockType?: AccountType
}) {
  const createAcc = useCreateAccount()
  const updateAcc = useUpdateAccount()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [balanceRaw, setBalanceRaw] = useState('')
  const [color, setColor] = useState('#10b981')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(editing.name)
      setType(editing.type)
      setBalanceRaw(String(editing.opening_balance))
      setColor(editing.color)
    } else {
      setName('')
      setType(lockType ?? 'bank')
      setBalanceRaw('')
      setColor('#10b981')
    }
  }, [open, editing, lockType])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('Nama akun wajib diisi', 'error')
      return
    }
    let opening_balance = 0
    if (balanceRaw.trim() !== '') {
      const parsed = parseAmountInput(balanceRaw)
      if (parsed === null) {
        toast('Saldo tidak valid', 'error')
        return
      }
      opening_balance = parsed
    }
    setSaving(true)
    try {
      if (editing) {
        await updateAcc.mutateAsync({ id: editing.id, name: name.trim(), type, opening_balance, color })
        toast('Akun diperbarui')
      } else {
        await createAcc.mutateAsync({ name: name.trim(), type, opening_balance, color })
        toast('Akun ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan akun', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Akun' : 'Tambah Akun'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama akun" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: BRI, GoPay, Dompet" />
        {!lockType && (
          <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        )}
        <Input label="Saldo awal (Rp)" inputMode="numeric" value={balanceRaw} onChange={(e) => setBalanceRaw(e.target.value)} placeholder="0" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Warna</span>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border-subtle bg-surface-soft" />
            <span className="text-sm text-ink-muted">{color}</span>
          </div>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}
