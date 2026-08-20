import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useUpdateTransaction, type TransactionInput } from '../../hooks/useTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import { uploadReceipt, removeReceipt } from '../receipt/receiptStorage'
import { ReceiptUpload } from '../receipt/ReceiptUpload'
import type { Transaction, TransactionType } from '../../types/database'

export function TransactionForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
}) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const updateTx = useUpdateTransaction()
  const qc = useQueryClient()
  const { toast } = useToast()

  const [type, setType] = useState<TransactionType>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])
  const typeCategories = useMemo(
    () => (type === 'transfer' ? [] : (categories ?? []).filter((c) => c.type === (type === 'income' ? 'income' : 'expense'))),
    [categories, type],
  )

  useEffect(() => {
    if (!open) return
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(editing.type)
      setAccountId(editing.account_id)
      setCategoryId(editing.category_id ?? '')
      setToAccountId(editing.to_account_id ?? '')
      setAmountRaw(String(editing.amount))
      setDate(editing.date)
      setNote(editing.note)
      setReceiptPath(editing.receipt_url)
      setReceiptFile(null)
    } else {
      setType('expense')
      setAccountId(activeAccounts[0]?.id ?? '')
      setCategoryId('')
      setToAccountId('')
      setAmountRaw('')
      setDate(todayISO())
      setNote('')
      setReceiptPath(null)
      setReceiptFile(null)
    }
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amount = parseAmountInput(amountRaw)
    const problems: Record<string, string> = {}
    if (amount === null) problems.amount = 'Masukkan jumlah yang valid'
    if (!accountId) problems.accountId = 'Pilih akun'
    if (type !== 'transfer' && !categoryId) problems.categoryId = 'Pilih kategori'
    if (type === 'transfer' && !toAccountId) problems.toAccountId = 'Pilih akun tujuan'
    if (type === 'transfer' && toAccountId === accountId) problems.toAccountId = 'Akun tujuan tidak boleh sama'
    if (!date) problems.date = 'Pilih tanggal'
    setErrors(problems)
    if (Object.keys(problems).length > 0 || amount === null) return

    setSaving(true)
    try {
      const base: TransactionInput = {
        account_id: accountId,
        type,
        category_id: type === 'transfer' ? null : categoryId || null,
        amount,
        to_account_id: type === 'transfer' ? toAccountId : null,
        note,
        date,
        receipt_url: type === 'transfer' ? null : receiptPath ?? null,
      }

      if (editing) {
        const oldReceipt = editing.receipt_url
        await updateTx.mutateAsync({ id: editing.id, ...base })
        if (receiptFile && oldReceipt) await removeReceipt(oldReceipt)
        if (receiptFile) {
          const finalPath = await uploadReceipt(receiptFile, user.id, editing.id)
          await supabase.from('transactions').update({ receipt_url: finalPath }).eq('id', editing.id)
        } else if (receiptPath === null && oldReceipt) {
          await removeReceipt(oldReceipt)
        }
        toast('Transaksi diperbarui')
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert({ ...base, user_id: user.id, receipt_url: receiptFile ? null : base.receipt_url })
          .select('id')
          .single()
        if (error) throw error
        if (receiptFile) {
          const finalPath = await uploadReceipt(receiptFile, user.id, data.id)
          await supabase.from('transactions').update({ receipt_url: finalPath }).eq('id', data.id)
        }
        qc.invalidateQueries({ queryKey: ['transactions'] })
        qc.invalidateQueries({ queryKey: ['accounts'] })
        toast('Transaksi ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan transaksi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Transaksi' : 'Tambah Transaksi'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" form="tx-form" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                type === t
                  ? t === 'expense' ? 'border-bad bg-bad/15 text-bad'
                    : t === 'income' ? 'border-good bg-good/15 text-good'
                    : 'border-move bg-move/15 text-move'
                  : 'border-border-subtle text-ink-muted hover:text-ink'
              }`}
            >
              {t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Input
            label="Jumlah (Rp)"
            inputMode="numeric"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            error={errors.amount}
            placeholder="0"
          />
          {parseAmountInput(amountRaw) !== null && (
            <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">
              = {formatRupiah(parseAmountInput(amountRaw)!)}
            </span>
          )}
        </div>

        <Select label="Akun" value={accountId} onChange={(e) => setAccountId(e.target.value)} error={errors.accountId}>
          <option value="">Pilih akun…</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        {type === 'transfer' ? (
          <Select label="Transfer ke" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} error={errors.toAccountId}>
            <option value="">Pilih akun tujuan…</option>
            {activeAccounts.filter((a) => a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        ) : (
          <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={errors.categoryId}>
            <option value="">Pilih kategori…</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}

        <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />

        <Textarea label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: belanja bulanan" />

        {type !== 'transfer' && (
          <ReceiptUpload
            current={receiptPath}
            onChange={(path, file) => {
              setReceiptPath(path)
              setReceiptFile(file ?? null)
            }}
          />
        )}
      </form>
    </Modal>
  )
}
