import { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { receiptUrl } from './receiptStorage'

export function ReceiptUpload({
  current,
  onChange,
}: {
  current: string | null
  onChange: (path: string | null, file?: File) => void
}) {
  const [resolved, setResolved] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!current || current.startsWith('blob:')) return
    receiptUrl(current).then((url) => {
      if (url) setResolved((prev) => ({ ...prev, [current]: url }))
    })
  }, [current])

  const preview = current ? (current.startsWith('blob:') ? current : resolved[current] ?? null) : null

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">Bukti transaksi (opsional)</span>
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border-subtle">
          <img src={preview} alt="Pratinjau bukti" className="h-32 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Hapus bukti"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-soft/50 px-4 py-6 text-sm text-ink-muted hover:border-good hover:text-good">
          <Upload className="h-5 w-5" />
          Klik untuk pilih foto struk
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  alert('Ukuran file maksimal 5 MB')
                  return
                }
                onChange('blob:' + file.name, file)
              }
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
