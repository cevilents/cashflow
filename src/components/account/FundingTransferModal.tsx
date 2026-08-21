import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useAccounts } from '../../hooks/useAccounts'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import { isSpendableAccount } from '../../lib/accounts'
import type { Account } from '../../types/database'

export function FundingTransferModal({
  open,
  onClose,
  source,
}: {
  open: boolean
  onClose: () => void
  source: Account | null
}) {
  const { data: accounts } = useAccounts()
  const createTx = useCreateTransaction()
  const { toast } = useToast()
  const [to, setTo] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const destinations = useMemo(
    () => (accounts ?? []).filter((a) => !a.is_archived && a.id !== source?.id && isSpendableAccount(a)),
    [accounts, source],
  )

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTo('')
    setAmountRaw('')
    setDate(todayISO())
    setNote('')
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    if (!to) {
      toast('Pilih akun tujuan', 'error')
      return
    }
    const amount = parseAmountInput(amountRaw)
    if (amount === null) {
      toast('Masukkan jumlah yang valid', 'error')
      return
    }
    setSaving(true)
    try {
      await createTx.mutateAsync({
        account_id: source.id,
        type: 'transfer',
        category_id: null,
        amount,
        to_account_id: to,
        note,
        date,
        receipt_url: null,
      })
      toast('Transfer berhasil')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal transfer', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer dari Sumber Dana">
      {source ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-surface-soft px-4 py-3">
            <span className="text-xs font-medium text-ink-muted">Dari</span>
            <p className="text-sm font-semibold text-ink">{source.name}</p>
          </div>
          <Select label="Ke akun" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Pilih…</option>
            {destinations.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <div className="relative">
            <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
            {parseAmountInput(amountRaw) !== null && (
              <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
            )}
          </div>
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: penarikan profit" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Transfer'}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
