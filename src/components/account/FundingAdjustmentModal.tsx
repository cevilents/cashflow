import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useCreateFundingTransaction } from '../../hooks/useFundingTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import type { Account } from '../../types/database'

type AdjustmentKind = 'topup' | 'withdraw'

export function FundingAdjustmentModal({
  open,
  onClose,
  source,
}: {
  open: boolean
  onClose: () => void
  source: Account | null
}) {
  const createAdj = useCreateFundingTransaction()
  const { toast } = useToast()
  const [kind, setKind] = useState<AdjustmentKind>('topup')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind('topup')
    setAmountRaw('')
    setDate(todayISO())
    setNote('')
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    const amount = parseAmountInput(amountRaw)
    if (amount === null) {
      toast('Masukkan jumlah yang valid', 'error')
      return
    }
    const signed = kind === 'withdraw' ? -amount : amount
    setSaving(true)
    try {
      await createAdj.mutateAsync({ account_id: source.id, amount: signed, date, note })
      toast('Penyesuaian disimpan')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal simpan penyesuaian', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Penyesuaian Saldo">
      {source ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-surface-soft px-4 py-3">
            <span className="text-xs font-medium text-ink-muted">Sumber dana</span>
            <p className="text-sm font-semibold text-ink">{source.name}</p>
          </div>
          <Select label="Jenis" value={kind} onChange={(e) => setKind(e.target.value as AdjustmentKind)}>
            <option value="topup">Top Up (tambah saldo)</option>
            <option value="withdraw">Penarikan (kurang saldo)</option>
          </Select>
          <div className="relative">
            <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
            {parseAmountInput(amountRaw) !== null && (
              <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
            )}
          </div>
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: top up bulanan" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
