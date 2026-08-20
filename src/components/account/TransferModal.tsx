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

export function TransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: accounts } = useAccounts()
  const createTx = useCreateTransaction()
  const { toast } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const active = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])

  useEffect(() => {
    if (!open) return
    const first = active[0]
    if (!first) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(first.id)
    setTo('')
    setAmountRaw('')
    setDate(todayISO())
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active.length])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!from || !to) {
      toast('Pilih akun asal dan tujuan', 'error')
      return
    }
    if (from === to) {
      toast('Akun asal dan tujuan tidak boleh sama', 'error')
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
        account_id: from,
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
    <Modal open={open} onClose={onClose} title="Transfer Antar Akun">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Dari akun" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Pilih…</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select label="Ke akun" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Pilih…</option>
            {active.filter((a) => a.id !== from).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <div className="relative">
          <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
          {parseAmountInput(amountRaw) !== null && (
            <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
          )}
        </div>
        <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: transfer ke tabungan" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Transfer'}</Button>
        </div>
      </form>
    </Modal>
  )
}
