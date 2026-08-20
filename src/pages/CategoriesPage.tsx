import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, Tag, ShoppingCart, Utensils, Car, Home, Zap, Smartphone,
  Tv, Plane, Gift, Briefcase, Banknote, HeartPulse, GraduationCap, Gamepad2, Wifi,
} from 'lucide-react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { Category, CategoryType } from '../types/database'

const ICONS: Record<string, typeof Tag> = {
  tag: Tag, shopping: ShoppingCart, food: Utensils, car: Car, home: Home, energy: Zap,
  phone: Smartphone, entertainment: Tv, travel: Plane, gift: Gift, salary: Briefcase,
  income: Banknote, health: HeartPulse, education: GraduationCap, game: Gamepad2, internet: Wifi,
}

export function CategoryForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Category | null
}) {
  const createCat = useCreateCategory()
  const updateCat = useUpdateCategory()
  const { toast } = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<CategoryType>(editing?.type ?? 'expense')
  const [icon, setIcon] = useState(editing?.icon ?? 'tag')
  const [color, setColor] = useState(editing?.color ?? '#38bdf8')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('Nama kategori wajib diisi', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCat.mutateAsync({ id: editing.id, name: name.trim(), type, icon, color })
        toast('Kategori diperbarui')
      } else {
        await createCat.mutateAsync({ name: name.trim(), type, icon, color })
        toast('Kategori ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan kategori', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Kategori' : 'Tambah Kategori'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Makanan" />
        <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </Select>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Ikon</span>
          <div className="grid grid-cols-8 gap-2">
            {Object.entries(ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
                  icon === key
                    ? 'border-good bg-good/15 text-good'
                    : 'border-border-subtle text-ink-muted hover:text-ink'
                }`}
                aria-label={`Ikon ${key}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
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

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const { data: transactions } = useTransactions()
  const deleteCat = useDeleteCategory()
  const { toast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [formSeq, setFormSeq] = useState(0)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const txCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of transactions ?? []) {
      if (t.category_id) counts[t.category_id] = (counts[t.category_id] ?? 0) + 1
    }
    return counts
  }, [transactions])

  const confirmDelete = async () => {
    if (!deleting || deleteCat.isPending) return
    try {
      await deleteCat.mutateAsync(deleting.id)
      toast('Kategori dihapus')
      setDeleting(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus kategori', 'error')
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const renderGroup = (type: CategoryType, label: string) => {
    const items = (categories ?? []).filter((c) => c.type === type)
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">{label}</h2>
        {items.length === 0 ? (
          <EmptyState title={`Belum ada kategori ${label.toLowerCase()}`} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => {
              const Icon = ICONS[c.icon] ?? Tag
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${c.color}22`, color: c.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{c.name}</span>
                  <span className="text-xs text-ink-muted">{txCountByCategory[c.id] ?? 0} transaksi</span>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormSeq((s) => s + 1); setFormOpen(true) }} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} aria-label="Hapus" className="text-bad">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Kategori</h1>
          <p className="text-sm text-ink-muted">Kelola kategori pemasukan dan pengeluaran</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormSeq((s) => s + 1); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {renderGroup('expense', 'Pengeluaran')}
      {renderGroup('income', 'Pemasukan')}

      <CategoryForm key={formSeq} open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus kategori?"
        message="Transaksi yang memakai kategori ini tetap ada, hanya saja kategorinya dihapus."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteCat.isPending}
      />
    </div>
  )
}
